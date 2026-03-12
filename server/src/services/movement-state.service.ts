// Responsável por validar deslocamento horizontal por tick com velocidade autoritativa do servidor.
import type { MatchPlayerState } from "../models/match-player.model.js";

export const MOVEMENT_STATE_CONFIG = {
  walkSpeed: 5.4,
  runSpeedMultiplier: 2.3,
  minMoveDeltaSeconds: 1 / 120,
  maxMoveDeltaSeconds: 0.2,
  horizontalDistanceTolerance: 0.08,
  ledgeSnapDistanceTolerance: 0.95
} as const;

export type PlayerMovementState = {
  lastMoveAt: number;
};

type AuthoritativeMoveValidationOptions = {
  player: MatchPlayerState;
  desiredX: number;
  desiredY: number;
  desiredZ: number;
  rotationY: number;
  targetLocomotionState?: MatchPlayerState["locomotionState"];
  movementState: PlayerMovementState;
  now: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveRunSpeed(): number {
  return MOVEMENT_STATE_CONFIG.walkSpeed * MOVEMENT_STATE_CONFIG.runSpeedMultiplier;
}

function isLedgeLocomotionState(
  locomotionState: MatchPlayerState["locomotionState"] | undefined
): boolean {
  return locomotionState === "LedgeHang" || locomotionState === "LedgeClimb";
}

function canPlayerMove(player: MatchPlayerState, now: number): boolean {
  if (!player.isAlive) {
    return false;
  }

  if (player.isGuardBroken) {
    return false;
  }

  if (now < player.stunUntil) {
    return false;
  }

  return true;
}

function resolveMovementSpeed(player: MatchPlayerState, now: number): number {
  if (!canPlayerMove(player, now)) {
    return 0;
  }

  if (player.isBlocking) {
    return MOVEMENT_STATE_CONFIG.walkSpeed * 0.68;
  }

  return player.isSprinting ? resolveRunSpeed() : MOVEMENT_STATE_CONFIG.walkSpeed;
}

export function initializePlayerMovementState(now: number = Date.now()): PlayerMovementState {
  return {
    lastMoveAt: now
  };
}

export function applyAuthoritativeMovementValidation(
  options: AuthoritativeMoveValidationOptions
): { x: number; y: number; z: number; rotationY: number } {
  if (!canPlayerMove(options.player, options.now)) {
    return {
      x: options.player.x,
      y: options.player.y,
      z: options.player.z,
      rotationY: options.rotationY
    };
  }

  const elapsedSeconds = clamp(
    (options.now - options.movementState.lastMoveAt) / 1000,
    MOVEMENT_STATE_CONFIG.minMoveDeltaSeconds,
    MOVEMENT_STATE_CONFIG.maxMoveDeltaSeconds
  );
  options.movementState.lastMoveAt = options.now;

  const horizontalDeltaX = options.desiredX - options.player.x;
  const horizontalDeltaZ = options.desiredZ - options.player.z;
  const desiredHorizontalDistance = Math.hypot(horizontalDeltaX, horizontalDeltaZ);
  const allowedHorizontalDistance =
    resolveMovementSpeed(options.player, options.now) * elapsedSeconds +
    MOVEMENT_STATE_CONFIG.horizontalDistanceTolerance +
    (isLedgeLocomotionState(options.targetLocomotionState)
      ? MOVEMENT_STATE_CONFIG.ledgeSnapDistanceTolerance
      : 0);

  if (desiredHorizontalDistance <= allowedHorizontalDistance || desiredHorizontalDistance <= 0.000001) {
    return {
      x: options.desiredX,
      y: options.desiredY,
      z: options.desiredZ,
      rotationY: options.rotationY
    };
  }

  const allowedRatio = allowedHorizontalDistance / desiredHorizontalDistance;
  return {
    x: options.player.x + horizontalDeltaX * allowedRatio,
    y: options.desiredY,
    z: options.player.z + horizontalDeltaZ * allowedRatio,
    rotationY: options.rotationY
  };
}
