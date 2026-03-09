// Responsável por controlar câmera third-person com follow suave, mouse-look e pequenos feedbacks de gameplay.
import { ArcRotateCamera, TransformNode, Vector3, type Scene } from "@babylonjs/core";

export type CameraControllerFrameInput = {
  deltaSeconds: number;
  playerTransform: { x: number; y: number; z: number };
  isPointerLocked: boolean;
  isInputEnabled: boolean;
  isSprinting: boolean;
  didLand: boolean;
};

export type CameraController = {
  camera: ArcRotateCamera;
  targetNode: TransformNode;
  addPointerDelta: (deltaX: number, deltaY: number) => void;
  syncLook: (isPointerLocked: boolean, isInputEnabled: boolean) => void;
  tick: (input: CameraControllerFrameInput) => void;
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

const DEFAULT_RADIUS = 6.9;
const DEFAULT_MOUSE_SENSITIVITY = 0.0022;
const DEFAULT_MIN_BETA = 0.08;
const DEFAULT_MAX_BETA = Math.PI - 0.08;
const DEFAULT_TARGET_VERTICAL_OFFSET = 1.72;
const DEFAULT_TARGET_LATERAL_OFFSET = 0.92;
const TARGET_SMOOTH_TIME = 0.08;
const FOV_SMOOTH_TIME = 0.11;
const BASE_FOV = 0.88;
const SPRINT_FOV = 0.96;
const LANDING_PITCH_KICK = 0.04;
const LANDING_RECOVERY_SPEED = 10;

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
  const radius = options.radius ?? DEFAULT_RADIUS;
  const mouseSensitivity = options.mouseSensitivity ?? DEFAULT_MOUSE_SENSITIVITY;
  const minBeta = options.minBeta ?? DEFAULT_MIN_BETA;
  const maxBeta = options.maxBeta ?? DEFAULT_MAX_BETA;
  const targetVerticalOffset = options.targetVerticalOffset ?? DEFAULT_TARGET_VERTICAL_OFFSET;
  const targetLateralOffset = options.targetLateralOffset ?? DEFAULT_TARGET_LATERAL_OFFSET;

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
  camera.fov = BASE_FOV;

  const targetNode = new TransformNode("globalMatchCameraTarget", options.scene);
  camera.lockedTarget = targetNode;

  let accumulatedMouseDeltaX = 0;
  let accumulatedMouseDeltaY = 0;
  let landingKick = 0;

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
      if (input.didLand) {
        landingKick = LANDING_PITCH_KICK;
      }

      if (landingKick > 0) {
        camera.beta = clamp(camera.beta + landingKick, minBeta, maxBeta);
        landingKick = Math.max(0, landingKick - LANDING_RECOVERY_SPEED * input.deltaSeconds);
      }

      const desiredTarget = resolveOverShoulderTargetPosition(
        input.playerTransform,
        camera.alpha,
        targetVerticalOffset,
        targetLateralOffset
      );
      const targetLerpFactor = resolveExponentialLerpFactor(input.deltaSeconds, TARGET_SMOOTH_TIME);
      targetNode.position.x += (desiredTarget.x - targetNode.position.x) * targetLerpFactor;
      targetNode.position.y += (desiredTarget.y - targetNode.position.y) * targetLerpFactor;
      targetNode.position.z += (desiredTarget.z - targetNode.position.z) * targetLerpFactor;

      const desiredFov = input.isSprinting ? SPRINT_FOV : BASE_FOV;
      const fovLerpFactor = resolveExponentialLerpFactor(input.deltaSeconds, FOV_SMOOTH_TIME);
      camera.fov += (desiredFov - camera.fov) * fovLerpFactor;
    },
    getGroundForward: () => {
      const forward = new Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha));
      if (forward.lengthSquared() <= 0.0001) {
        return new Vector3(0, 0, 1);
      }

      return forward.normalize();
    },
    dispose: () => {
      camera.lockedTarget = null;
      targetNode.dispose();
    }
  };
}
