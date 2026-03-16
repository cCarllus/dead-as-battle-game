// Responsável por adaptar a nova câmera shoulder third-person ao contrato usado pela cena de gameplay.
import type { Scene, TargetCamera, TransformNode, Vector3 } from "@babylonjs/core";
import type { CameraShakePreset } from "../camera/camera-shake";
import {
  createThirdPersonCamera,
  type ThirdPersonCameraFrameInput
} from "../camera/third-person-camera";
import { mergeThirdPersonCameraConfig } from "../camera/camera-config";

export type CameraControllerFrameInput = ThirdPersonCameraFrameInput;
export type CameraControllerViewSettings = {
  cameraFovPercent: number;
};

export type CameraController = {
  camera: TargetCamera;
  targetNode: TransformNode;
  addPointerDelta: (deltaX: number, deltaY: number) => void;
  syncLook: (isPointerLocked: boolean, isInputEnabled: boolean) => void;
  applyViewSettings: (settings: CameraControllerViewSettings) => void;
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

export function createCameraController(options: CreateCameraControllerOptions): CameraController {
  const legacyPitchMin =
    typeof options.maxBeta === "number" ? Math.PI / 2 - options.maxBeta : undefined;
  const legacyPitchMax =
    typeof options.minBeta === "number" ? Math.PI / 2 - options.minBeta : undefined;

  return createThirdPersonCamera({
    scene: options.scene,
    config: mergeThirdPersonCameraConfig({
      baseDistance: options.radius,
      sensitivityX: options.mouseSensitivity,
      sensitivityY: options.mouseSensitivity,
      minPitch:
        legacyPitchMin !== undefined && legacyPitchMax !== undefined
          ? Math.min(legacyPitchMin, legacyPitchMax)
          : undefined,
      maxPitch:
        legacyPitchMin !== undefined && legacyPitchMax !== undefined
          ? Math.max(legacyPitchMin, legacyPitchMax)
          : undefined,
      cameraTargetOffsetY: options.targetVerticalOffset,
      targetShoulderOffsetX: options.targetLateralOffset
    })
  });
}
