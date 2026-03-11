// Responsável por converter snapshot de locomoção em offsets de câmera futuros e reutilizáveis.
import type { CharacterLocomotionSnapshot } from "../locomotion/locomotion-state";

export type LocomotionCameraHooks = {
  targetOffsetY: number;
  lateralOffset: number;
  additionalFovRadians: number;
  wallRunTiltRadians: number;
};

export function resolveLocomotionCameraHooks(
  snapshot: CharacterLocomotionSnapshot
): LocomotionCameraHooks {
  return {
    targetOffsetY:
      snapshot.crouchAlpha * snapshot.cameraProfile.crouchOffsetY +
      snapshot.slideAlpha * snapshot.cameraProfile.slideOffsetY,
    lateralOffset: snapshot.isWallRunning ? 0.06 : 0,
    additionalFovRadians:
      (snapshot.isSprinting ? snapshot.cameraProfile.sprintFovBoostRadians : 0) +
      (snapshot.isWallRunning ? snapshot.cameraProfile.wallRunFovBoostRadians : 0),
    wallRunTiltRadians:
      snapshot.isWallRunning && snapshot.wallRunSide !== "none"
        ? snapshot.cameraProfile.wallRunTiltRadians * (snapshot.wallRunSide === "left" ? -1 : 1)
        : 0
  };
}

