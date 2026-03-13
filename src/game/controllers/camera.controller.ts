// Responsável por controlar câmera third-person com smoothing, head bob, tilt, sprint feedback e camera shake.
import { ArcRotateCamera, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import { createCameraShakeSystem, type CameraShakePreset } from "../camera/camera-shake";
import { createHeadBobSystem } from "../camera/head-bob";
import { DEFAULT_CAMERA_CONTROLLER_CONFIG } from "../config/camera.config";

export type CameraControllerFrameInput = {
  deltaSeconds: number;
  playerTransform: { x: number; y: number; z: number };
  isPointerLocked: boolean;
  isInputEnabled: boolean;
  isSprinting: boolean;
  isSprintBurstActive: boolean;
  speedFeedback: number;
  isMoving: boolean;
  isGrounded: boolean;
  turnInput: number;
  landingImpact: number;
  targetOffsetY: number;
  lateralOffset: number;
  additionalFovRadians: number;
  wallRunTiltRadians: number;
};

export type CameraController = {
  camera: ArcRotateCamera;
  targetNode: TransformNode;
  addPointerDelta: (deltaX: number, deltaY: number) => void;
  syncLook: (isPointerLocked: boolean, isInputEnabled: boolean) => void;
  tick: (input: CameraControllerFrameInput) => void;
  triggerShake: (preset: CameraShakePreset, scale?: number) => void;
  getGroundForward: () => Vector3;
  dispose: () => void;
};

export type CreateCameraControllerOptions = {
  scene: Scene;
  radius?: number;
  mouseSensitivity?: number;
  minBeta?: number;
  maxBeta?: number;
  targetVerticalOffset?: number;
  targetLateralOffset?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveExponentialLerpFactor(deltaSeconds: number, smoothTimeSeconds: number): number {
  if (deltaSeconds <= 0) {
    return 0;
  }

  if (smoothTimeSeconds <= 0) {
    return 1;
  }

  return 1 - Math.exp(-deltaSeconds / smoothTimeSeconds);
}

function resolveOverShoulderTargetPosition(
  transform: { x: number; y: number; z: number },
  cameraAlpha: number,
  verticalOffset: number,
  lateralOffset: number
): Vector3 {
  const forwardX = -Math.cos(cameraAlpha);
  const forwardZ = -Math.sin(cameraAlpha);
  const rightX = forwardZ;
  const rightZ = -forwardX;

  return new Vector3(
    transform.x + rightX * lateralOffset,
    transform.y + verticalOffset,
    transform.z + rightZ * lateralOffset
  );
}

export function createCameraController(options: CreateCameraControllerOptions): CameraController {
  const radius = options.radius ?? DEFAULT_CAMERA_CONTROLLER_CONFIG.radius;
  const mouseSensitivity = options.mouseSensitivity ?? DEFAULT_CAMERA_CONTROLLER_CONFIG.mouseSensitivity;
  const minBeta = options.minBeta ?? DEFAULT_CAMERA_CONTROLLER_CONFIG.minBeta;
  const maxBeta = options.maxBeta ?? DEFAULT_CAMERA_CONTROLLER_CONFIG.maxBeta;
  const targetVerticalOffset =
    options.targetVerticalOffset ?? DEFAULT_CAMERA_CONTROLLER_CONFIG.targetVerticalOffset;
  const targetLateralOffset =
    options.targetLateralOffset ?? DEFAULT_CAMERA_CONTROLLER_CONFIG.targetLateralOffset;

  const camera = new ArcRotateCamera(
    "globalMatchCamera",
    -Math.PI / 2,
    1.02,
    radius,
    new Vector3(0, 1.2, 0),
    options.scene
  );

  camera.inputs.clear();
  camera.radius = radius;
  camera.lowerRadiusLimit = radius;
  camera.upperRadiusLimit = radius;
  camera.lowerBetaLimit = minBeta;
  camera.upperBetaLimit = maxBeta;
  camera.fov = DEFAULT_CAMERA_CONTROLLER_CONFIG.baseFovRadians;

  const targetNode = new TransformNode("globalMatchCameraTarget", options.scene);
  camera.lockedTarget = targetNode;

  const headBob = createHeadBobSystem();
  const shake = createCameraShakeSystem();

  let accumulatedMouseDeltaX = 0;
  let accumulatedMouseDeltaY = 0;
  let landingDrop = 0;
  let elapsedSeconds = 0;

  return {
    camera,
    targetNode,
    addPointerDelta: (deltaX, deltaY) => {
      accumulatedMouseDeltaX += deltaX;
      accumulatedMouseDeltaY += deltaY;
    },
    syncLook: (isPointerLocked, isInputEnabled) => {
      if (isPointerLocked && isInputEnabled) {
        camera.alpha -= accumulatedMouseDeltaX * mouseSensitivity;
        camera.beta = clamp(camera.beta - accumulatedMouseDeltaY * mouseSensitivity, minBeta, maxBeta);
      }

      accumulatedMouseDeltaX = 0;
      accumulatedMouseDeltaY = 0;
    },
    tick: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      elapsedSeconds += safeDelta;

      if (input.landingImpact > 0) {
        landingDrop +=
          DEFAULT_CAMERA_CONTROLLER_CONFIG.landingDropBase +
          DEFAULT_CAMERA_CONTROLLER_CONFIG.landingDropScale * input.landingImpact;
        shake.triggerPreset("medium", 0.5 + input.landingImpact * 0.9);
      }

      if (input.isSprintBurstActive) {
        shake.triggerPreset("light", 0.55);
      }

      landingDrop = Math.max(
        0,
        landingDrop - DEFAULT_CAMERA_CONTROLLER_CONFIG.landingRecoverySpeed * safeDelta
      );

      const bobOffset = headBob.update({
        deltaSeconds: safeDelta,
        isGrounded: input.isGrounded,
        isMoving: input.isMoving,
        isSprinting: input.isSprinting,
        speedNormalized: input.speedFeedback
      });

      const shakeOffset = shake.sample(safeDelta);

      const sprintVibration = input.isSprinting
        ? Math.sin(elapsedSeconds * 40) *
          DEFAULT_CAMERA_CONTROLLER_CONFIG.sprintCameraVibration *
          input.speedFeedback
        : 0;

      camera.alpha += shakeOffset.yaw + sprintVibration * 0.5;
      camera.beta = clamp(camera.beta + shakeOffset.pitch + sprintVibration, minBeta, maxBeta);

      const desiredTarget = resolveOverShoulderTargetPosition(
        input.playerTransform,
        camera.alpha,
        targetVerticalOffset + input.targetOffsetY,
        targetLateralOffset + input.lateralOffset
      );
      const targetLerpFactor = resolveExponentialLerpFactor(
        safeDelta,
        DEFAULT_CAMERA_CONTROLLER_CONFIG.targetSmoothTimeSeconds
      );
      const targetY = desiredTarget.y + bobOffset - landingDrop;

      targetNode.position.x += (desiredTarget.x - targetNode.position.x) * targetLerpFactor;
      targetNode.position.y += (targetY - targetNode.position.y) * targetLerpFactor;
      targetNode.position.z += (desiredTarget.z - targetNode.position.z) * targetLerpFactor;

      const burstKick = input.isSprintBurstActive
        ? DEFAULT_CAMERA_CONTROLLER_CONFIG.sprintBurstFovKickRadians
        : 0;
      const locomotionFovBoost = input.additionalFovRadians * (input.isMoving ? Math.max(0.4, input.speedFeedback) : 1);
      const desiredFov = DEFAULT_CAMERA_CONTROLLER_CONFIG.baseFovRadians + locomotionFovBoost + burstKick;
      const fovLerpFactor = resolveExponentialLerpFactor(
        safeDelta,
        DEFAULT_CAMERA_CONTROLLER_CONFIG.fovSmoothTimeSeconds
      );
      camera.fov += (desiredFov - camera.fov) * fovLerpFactor;

      const desiredScreenOffsetX = input.wallRunTiltRadians * 90;
      const screenOffsetLerpFactor = resolveExponentialLerpFactor(
        safeDelta,
        DEFAULT_CAMERA_CONTROLLER_CONFIG.screenOffsetSmoothTimeSeconds
      );
      camera.targetScreenOffset.x +=
        (desiredScreenOffsetX - camera.targetScreenOffset.x) * screenOffsetLerpFactor;
      camera.targetScreenOffset.y += (0 - camera.targetScreenOffset.y) * screenOffsetLerpFactor;
    },
    triggerShake: (preset, scale = 1) => {
      shake.triggerPreset(preset, scale);
    },
    getGroundForward: () => {
      const forward = new Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha));
      if (forward.lengthSquared() <= 0.0001) {
        return new Vector3(0, 0, 1);
      }

      return forward.normalize();
    },
    dispose: () => {
      headBob.reset();
      shake.reset();
      camera.lockedTarget = null;
      targetNode.dispose();
    }
  };
}
