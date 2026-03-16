// Responsible for running the modular shoulder camera with orbit look, smooth follow, FOV reactions, and collision recovery.
import { TargetCamera, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import { createCameraCollisionSystem } from "./camera-collision";
import { createCameraDebugSystem } from "./camera-debug";
import {
  DEFAULT_THIRD_PERSON_CAMERA_CONFIG,
  DEFAULT_CAMERA_SETTINGS_PERCENT,
  clampCameraSettingsPercent,
  mergeThirdPersonCameraConfig,
  resolveCameraDistanceOffsetFromPercent,
  resolveFovAdjustmentRadiansFromPercent,
  resolveConfiguredBaseFovRadians,
  type ThirdPersonCameraConfig
} from "./camera-config";
import { createCameraShakeSystem, type CameraShakePreset } from "./camera-shake";
import { createCameraStateController } from "./camera-state-controller";
import { createCameraTiltSystem } from "./camera-tilt";
import { createHeadBobSystem } from "./head-bob";
import type { CharacterLocomotionSnapshot } from "../locomotion/locomotion-state";

export type ThirdPersonCameraFrameInput = {
  deltaSeconds: number;
  snapshot: CharacterLocomotionSnapshot;
  cameraTarget: { x: number; y: number; z: number };
  lockOnTarget?: { x: number; y: number; z: number } | null;
  isSprintBurstActive: boolean;
};

export type ThirdPersonCamera = {
  camera: TargetCamera;
  targetNode: TransformNode;
  addPointerDelta: (deltaX: number, deltaY: number) => void;
  syncLook: (isPointerLocked: boolean, isInputEnabled: boolean) => void;
  applyViewSettings: (settings: { cameraFovPercent: number }) => void;
  tick: (input: ThirdPersonCameraFrameInput) => void;
  triggerShake: (preset: CameraShakePreset, scale?: number) => void;
  getGroundForward: () => Vector3;
  dispose: () => void;
};

export type CreateThirdPersonCameraOptions = {
  scene: Scene;
  config?: Partial<ThirdPersonCameraConfig>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveDampFactor(deltaSeconds: number, speed: number): number {
  if (deltaSeconds <= 0) {
    return 0;
  }

  if (speed <= 0) {
    return 1;
  }

  return 1 - Math.exp(-speed * deltaSeconds);
}

function damp(value: number, target: number, speed: number, deltaSeconds: number): number {
  return value + (target - value) * resolveDampFactor(deltaSeconds, speed);
}

function dampVector(
  current: Vector3,
  target: Vector3,
  speed: number,
  deltaSeconds: number
): void {
  const factor = resolveDampFactor(deltaSeconds, speed);
  current.x += (target.x - current.x) * factor;
  current.y += (target.y - current.y) * factor;
  current.z += (target.z - current.z) * factor;
}

function resolveGroundForward(yaw: number): Vector3 {
  const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  if (forward.lengthSquared() <= 0.0001) {
    return new Vector3(0, 0, 1);
  }

  return forward.normalize();
}

function rotateVectorAroundAxis(vector: Vector3, axis: Vector3, angle: number): Vector3 {
  const normalizedAxis = axis.lengthSquared() > 0.0001 ? axis.normalizeToNew() : new Vector3(0, 0, 1);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const firstTerm = vector.scale(cos);
  const secondTerm = Vector3.Cross(normalizedAxis, vector).scale(sin);
  const thirdTerm = normalizedAxis.scale(Vector3.Dot(normalizedAxis, vector) * (1 - cos));
  return firstTerm.add(secondTerm).add(thirdTerm);
}

function resolveOrientationBasis(yaw: number, pitch: number): {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
} {
  const cosPitch = Math.cos(pitch);
  const forward = new Vector3(
    Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
    Math.cos(yaw) * cosPitch
  ).normalize();
  const right = Vector3.Cross(new Vector3(0, 1, 0), forward).normalize();
  const up = Vector3.Cross(forward, right).normalize();

  return {
    forward,
    right,
    up
  };
}

export function createThirdPersonCamera(
  options: CreateThirdPersonCameraOptions
): ThirdPersonCamera {
  const config = mergeThirdPersonCameraConfig(
    DEFAULT_THIRD_PERSON_CAMERA_CONFIG,
    options.config
  );
  const stateController = createCameraStateController(config);
  const collisionSystem = createCameraCollisionSystem(options.scene);
  const debugSystem = createCameraDebugSystem(options.scene, config.debugLogIntervalMs);
  const headBob = createHeadBobSystem();
  const shake = createCameraShakeSystem();
  const tilt = createCameraTiltSystem({
    maxTiltRadians: config.sprintTurnTiltRadians,
    inSpeed: config.tiltLerpSpeed,
    outSpeed: Math.max(1, config.tiltLerpSpeed * 0.82)
  });

  const camera = new TargetCamera(
    "globalMatchCamera",
    new Vector3(0, config.baseHeight + 1.4, -config.baseDistance),
    options.scene
  );
  camera.minZ = 0.05;
  camera.fov = resolveConfiguredBaseFovRadians(config);

  const targetNode = new TransformNode("globalMatchCameraTarget", options.scene);

  let accumulatedMouseDeltaX = 0;
  let accumulatedMouseDeltaY = 0;
  let desiredYaw = 0;
  let desiredPitch = 0.18;
  let currentYaw = desiredYaw;
  let currentPitch = desiredPitch;
  let landingDrop = 0;
  let elapsedSeconds = 0;
  const currentFocusPoint = new Vector3(0, 1.4, 0);
  const currentCameraPosition = camera.position.clone();
  let currentCameraFovPercent = DEFAULT_CAMERA_SETTINGS_PERCENT;
  let currentCameraDistanceOffset = 0;

  const applyViewSettings = (settings: { cameraFovPercent: number }): void => {
    currentCameraFovPercent = clampCameraSettingsPercent(
      settings.cameraFovPercent,
      currentCameraFovPercent
    );
    config.userFovAdjustmentRadians = resolveFovAdjustmentRadiansFromPercent(
      config,
      currentCameraFovPercent
    );
    currentCameraDistanceOffset = resolveCameraDistanceOffsetFromPercent(currentCameraFovPercent);
  };

  applyViewSettings({
    cameraFovPercent: currentCameraFovPercent
  });

  return {
    camera,
    targetNode,
    addPointerDelta: (deltaX, deltaY) => {
      accumulatedMouseDeltaX += deltaX;
      accumulatedMouseDeltaY += deltaY;
    },
    syncLook: (isPointerLocked, isInputEnabled) => {
      if (isPointerLocked && isInputEnabled) {
        desiredYaw += accumulatedMouseDeltaX * config.sensitivityX;
        const pitchDirection = config.invertY ? 1 : -1;
        desiredPitch = clamp(
          desiredPitch + accumulatedMouseDeltaY * config.sensitivityY * pitchDirection,
          config.minPitch,
          config.maxPitch
        );
      }

      accumulatedMouseDeltaX = 0;
      accumulatedMouseDeltaY = 0;
    },
    applyViewSettings,
    tick: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      elapsedSeconds += safeDelta;

      if (input.snapshot.landingImpact > 0) {
        landingDrop +=
          config.landingDropBase + config.landingDropScale * input.snapshot.landingImpact;
        shake.triggerPreset("medium", 0.5 + input.snapshot.landingImpact * 0.9);
      }

      if (input.isSprintBurstActive) {
        shake.triggerPreset("light", 0.5);
      }

      landingDrop = Math.max(0, landingDrop - config.landingRecoverySpeed * safeDelta);

      const stateOutput = stateController.resolve({
        snapshot: input.snapshot,
        isSprintBurstActive: input.isSprintBurstActive
      });
      stateOutput.distance += currentCameraDistanceOffset;

      const bobOffset = headBob.update({
        deltaSeconds: safeDelta,
        isGrounded: input.snapshot.isGrounded,
        isMoving: input.snapshot.isMoving,
        isSprinting: input.snapshot.isSprinting,
        speedNormalized: input.snapshot.speedNormalized
      });
      const shakeOffset = shake.sample(safeDelta);
      const sprintTurnTilt = tilt.update({
        deltaSeconds: safeDelta,
        turnInput: input.snapshot.lateralInput,
        isSprinting: input.snapshot.isSprinting,
        isGrounded: input.snapshot.isGrounded
      });
      const sprintVibration = input.snapshot.isSprinting
        ? Math.sin(elapsedSeconds * 40) *
          config.sprintCameraVibration *
          Math.max(0.35, input.snapshot.speedNormalized)
        : 0;

      currentYaw = damp(
        currentYaw,
        desiredYaw + shakeOffset.yaw + sprintVibration * 0.5,
        stateOutput.rotationLerpSpeed,
        safeDelta
      );
      currentPitch = damp(
        currentPitch,
        clamp(
          desiredPitch + shakeOffset.pitch + sprintVibration,
          config.minPitch,
          config.maxPitch
        ),
        stateOutput.rotationLerpSpeed,
        safeDelta
      );

      const basis = resolveOrientationBasis(currentYaw, currentPitch);
      const groundForward = resolveGroundForward(currentYaw);
      const groundRight = new Vector3(groundForward.z, 0, -groundForward.x).normalize();

      const desiredFocusPoint = new Vector3(
        input.cameraTarget.x,
        input.cameraTarget.y,
        input.cameraTarget.z
      );
      desiredFocusPoint.addInPlace(groundRight.scale(stateOutput.focusOffsetX));
      desiredFocusPoint.addInPlace(groundForward.scale(stateOutput.focusLeadDistance));
      desiredFocusPoint.y += stateOutput.targetOffsetY + bobOffset - landingDrop;

      if (input.lockOnTarget) {
        desiredFocusPoint.x += (input.lockOnTarget.x - desiredFocusPoint.x) * 0.22;
        desiredFocusPoint.y += (input.lockOnTarget.y - desiredFocusPoint.y) * 0.12;
        desiredFocusPoint.z += (input.lockOnTarget.z - desiredFocusPoint.z) * 0.22;
      }

      dampVector(currentFocusPoint, desiredFocusPoint, stateOutput.followLerpSpeed, safeDelta);
      targetNode.position.copyFrom(currentFocusPoint);

      const shoulderAnchor = currentFocusPoint
        .add(basis.right.scale(stateOutput.shoulderOffsetX))
        .add(basis.up.scale(stateOutput.cameraHeightOffset + stateOutput.shoulderOffsetY))
        .add(groundForward.scale(stateOutput.shoulderOffsetZ));

      const desiredCameraPosition = shoulderAnchor.subtract(basis.forward.scale(stateOutput.distance));
      const collisionResult = collisionSystem.resolve({
        origin: currentFocusPoint,
        desiredPosition: desiredCameraPosition,
        right: basis.right,
        up: basis.up,
        collisionRadius: config.cameraCollisionRadius,
        collisionBuffer: config.collisionBuffer,
        minDistance: config.minDistance
      });

      dampVector(
        currentCameraPosition,
        collisionResult.position,
        collisionResult.hasHit ? config.collisionLerpSpeed : config.collisionRecoveryLerpSpeed,
        safeDelta
      );

      camera.position.copyFrom(currentCameraPosition);
      camera.upVector.copyFrom(
        rotateVectorAroundAxis(
          new Vector3(0, 1, 0),
          basis.forward,
          stateOutput.rollRadians + sprintTurnTilt
        ).normalize()
      );
      camera.setTarget(currentFocusPoint);
      camera.fov = damp(camera.fov, stateOutput.desiredFovRadians, config.fovLerpSpeed, safeDelta);

      debugSystem.render({
        focusPoint: currentFocusPoint,
        shoulderAnchor,
        desiredCameraPosition,
        finalCameraPosition: currentCameraPosition,
        currentFovRadians: camera.fov,
        targetFovRadians: stateOutput.desiredFovRadians,
        locomotionState: input.snapshot.state,
        collisionHit: collisionResult.hasHit
      });
    },
    triggerShake: (preset, scale = 1) => {
      shake.triggerPreset(preset, scale);
    },
    getGroundForward: () => {
      return resolveGroundForward(currentYaw);
    },
    dispose: () => {
      headBob.reset();
      shake.reset();
      tilt.reset();
      collisionSystem.dispose();
      debugSystem.dispose();
      targetNode.dispose();
      camera.dispose();
    }
  };
}
