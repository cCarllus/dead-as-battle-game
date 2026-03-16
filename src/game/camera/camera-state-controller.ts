// Responsible for translating locomotion state into camera framing, follow, FOV, and subtle motion targets.
import type { CharacterLocomotionSnapshot } from "../locomotion/locomotion-state";
import {
  resolveConfiguredBaseFovRadians,
  type ThirdPersonCameraConfig
} from "./camera-config";

export type CameraStateFrameInput = {
  snapshot: CharacterLocomotionSnapshot;
  isSprintBurstActive: boolean;
  shoulderSide: number;
};

export type CameraStateFrameOutput = {
  distance: number;
  cameraHeightOffset: number;
  shoulderOffsetX: number;
  shoulderOffsetY: number;
  shoulderOffsetZ: number;
  focusOffsetX: number;
  focusLeadDistance: number;
  targetOffsetY: number;
  desiredFovRadians: number;
  followLerpSpeed: number;
  rotationLerpSpeed: number;
  rollRadians: number;
};

export type CameraStateController = {
  resolve: (input: CameraStateFrameInput) => CameraStateFrameOutput;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isLedgeHangState(state: CharacterLocomotionSnapshot["state"]): boolean {
  return state === "LedgeHang" || state === "Hanging";
}

function isLedgeClimbState(state: CharacterLocomotionSnapshot["state"]): boolean {
  return state === "LedgeClimb" || state === "ClimbingUp" || state === "MantlingLowObstacle";
}

function isParkourState(snapshot: CharacterLocomotionSnapshot): boolean {
  return snapshot.isWallRunning || isLedgeHangState(snapshot.state) || isLedgeClimbState(snapshot.state);
}

export function createCameraStateController(
  config: ThirdPersonCameraConfig
): CameraStateController {
  return {
    resolve: (input) => {
      const { snapshot } = input;
      const shoulderSide = input.shoulderSide >= 0 ? 1 : -1;
      const crouchBlend = clamp01(Math.max(snapshot.crouchAlpha, snapshot.isCrouching ? 1 : 0));
      const rollBlend = clamp01(Math.max(snapshot.rollingAlpha, snapshot.isRolling ? 1 : 0));
      const hanging = isLedgeHangState(snapshot.state);
      const climbing = isLedgeClimbState(snapshot.state);
      const parkour = isParkourState(snapshot);

      let distance = config.baseDistance;
      let cameraHeightOffset = config.baseHeight;
      let shoulderOffsetX = config.shoulderOffsetX * shoulderSide;
      let shoulderOffsetY = config.shoulderOffsetY;
      let shoulderOffsetZ = config.shoulderOffsetZ;
      let focusOffsetX = config.targetShoulderOffsetX * shoulderSide;
      let focusLeadDistance = config.targetLeadDistance;
      let targetOffsetY = config.cameraTargetOffsetY;
      let desiredFovRadians = resolveConfiguredBaseFovRadians(config);
      let followLerpSpeed = config.followLerpSpeed;
      let rotationLerpSpeed = config.rotationLerpSpeed;
      let rollRadians = 0;

      if (crouchBlend > 0) {
        cameraHeightOffset += config.crouchHeightOffset * crouchBlend;
        targetOffsetY += config.crouchTargetOffsetY * crouchBlend;
      }

      if (snapshot.isSprinting) {
        distance += config.sprintDistanceOffset;
        focusLeadDistance += config.sprintLeadOffset;
        desiredFovRadians = Math.max(
          desiredFovRadians,
          config.sprintFovRadians + config.userFovAdjustmentRadians
        );
        followLerpSpeed *= config.sprintFollowLerpMultiplier;
      }

      if (rollBlend > 0) {
        distance += config.rollDistanceOffset * rollBlend;
        cameraHeightOffset += config.rollHeightOffset * rollBlend;
        focusLeadDistance += config.rollLeadOffset * rollBlend;
        desiredFovRadians = Math.max(
          desiredFovRadians,
          config.rollFovRadians + config.userFovAdjustmentRadians
        );
        followLerpSpeed *= config.rollFollowLerpMultiplier;
      }

      if (hanging) {
        distance += config.ledgeDistanceOffset;
        cameraHeightOffset += config.ledgeHeightOffset;
        targetOffsetY += config.ledgeTargetOffsetY;
      }

      if (climbing) {
        distance += config.climbDistanceOffset;
        cameraHeightOffset += config.climbHeightOffset;
        targetOffsetY += config.climbTargetOffsetY;
      }

      if (parkour) {
        distance += config.parkourDistanceOffset;
        cameraHeightOffset += config.parkourHeightOffset;
        targetOffsetY += config.parkourTargetOffsetY;
        desiredFovRadians = Math.max(
          desiredFovRadians,
          config.parkourFovRadians + config.userFovAdjustmentRadians
        );
        followLerpSpeed *= config.parkourFollowLerpMultiplier;
      }

      if (snapshot.isWallRunning) {
        rollRadians =
          config.wallRunRollRadians *
          (snapshot.wallRunSide === "left" ? -1 : snapshot.wallRunSide === "right" ? 1 : 0);
      }

      if (input.isSprintBurstActive) {
        desiredFovRadians += config.sprintBurstFovKickRadians;
      }

      desiredFovRadians = Math.min(
        config.maxAllowedFovRadians,
        Math.max(config.minAllowedFovRadians, desiredFovRadians)
      );
      distance = Math.max(config.minDistance, distance);

      return {
        distance,
        cameraHeightOffset,
        shoulderOffsetX,
        shoulderOffsetY,
        shoulderOffsetZ,
        focusOffsetX,
        focusLeadDistance,
        targetOffsetY,
        desiredFovRadians,
        followLerpSpeed,
        rotationLerpSpeed,
        rollRadians
      };
    }
  };
}
