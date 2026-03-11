// Encapsula validação de input, reconciliação autoritativa, hints de locomoção e colisão horizontal entre jogadores.
import type {
  MatchMovePayload,
  MatchPlayerLocomotionState,
  MatchPlayerState,
  MatchPlayerWallRunSide,
  MatchSprintIntentPayload
} from "../models/match-player.model.js";
import {
  applyAuthoritativeMovementValidation,
  initializePlayerMovementState,
  type PlayerMovementState
} from "./movement-state.service.js";
import type { SprintInputState } from "./stamina.service.js";

const PLAYER_COLLISION_RADIUS = 0.44;
const PLAYER_COLLISION_HEIGHT = 2.4;
const PLAYER_COLLISION_MIN_DISTANCE = PLAYER_COLLISION_RADIUS * 2;
const PLAYER_COLLISION_MIN_DISTANCE_SQUARED = PLAYER_COLLISION_MIN_DISTANCE * PLAYER_COLLISION_MIN_DISTANCE;
const PLAYER_COLLISION_EPSILON = 0.000001;
const PLAYER_COLLISION_RESOLVE_PASSES = 5;

function normalizeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

export type NormalizedMoveIntent = {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  locomotionState: MatchPlayerLocomotionState;
  isCrouching: boolean;
  isSliding: boolean;
  isWallRunning: boolean;
  wallRunSide: MatchPlayerWallRunSide;
  verticalVelocity: number;
};

const VALID_LOCOMOTION_STATES = new Set<MatchPlayerLocomotionState>([
  "Idle",
  "Walk",
  "Run",
  "RunStop",
  "JumpStart",
  "InAir",
  "Fall",
  "Land",
  "Crouch",
  "CrouchWalk",
  "Slide",
  "WallRun",
  "DoubleJump",
  "Attack",
  "Block",
  "Hit",
  "Stunned",
  "Dead"
]);

const VALID_WALL_RUN_SIDES = new Set<MatchPlayerWallRunSide>(["none", "left", "right"]);

function normalizeLocomotionState(value: unknown): MatchPlayerLocomotionState {
  return typeof value === "string" && VALID_LOCOMOTION_STATES.has(value as MatchPlayerLocomotionState)
    ? (value as MatchPlayerLocomotionState)
    : "Idle";
}

function normalizeWallRunSide(value: unknown): MatchPlayerWallRunSide {
  return typeof value === "string" && VALID_WALL_RUN_SIDES.has(value as MatchPlayerWallRunSide)
    ? (value as MatchPlayerWallRunSide)
    : "none";
}

export function normalizeMoveIntent(payload: MatchMovePayload | undefined): NormalizedMoveIntent | null {
  const x = normalizeNumber(payload?.x);
  const y = normalizeNumber(payload?.y);
  const z = normalizeNumber(payload?.z);
  const rotationY = normalizeNumber(payload?.rotationY);
  const verticalVelocity = normalizeNumber(payload?.verticalVelocity) ?? 0;

  if (x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  return {
    x,
    y,
    z,
    rotationY,
    locomotionState: normalizeLocomotionState(payload?.locomotionState),
    isCrouching: normalizeBoolean(payload?.isCrouching) ?? false,
    isSliding: normalizeBoolean(payload?.isSliding) ?? false,
    isWallRunning: normalizeBoolean(payload?.isWallRunning) ?? false,
    wallRunSide: normalizeWallRunSide(payload?.wallRunSide),
    verticalVelocity
  };
}

export function normalizeSprintIntent(payload: MatchSprintIntentPayload | undefined): SprintInputState | null {
  const isShiftPressed = normalizeBoolean(payload?.isShiftPressed);
  const isForwardPressed = normalizeBoolean(payload?.isForwardPressed);
  if (isShiftPressed === null || isForwardPressed === null) {
    return null;
  }

  return {
    isShiftPressed,
    isForwardPressed
  };
}

export function resolveHorizontalPlayerCollision(options: {
  sessionId: string;
  desiredX: number;
  desiredY: number;
  desiredZ: number;
  rotationY: number;
  players: Record<string, MatchPlayerState>;
}): { x: number; z: number } {
  let resolvedX = options.desiredX;
  let resolvedZ = options.desiredZ;

  const fallbackDirectionX = Math.sin(options.rotationY);
  const fallbackDirectionZ = Math.cos(options.rotationY);
  const fallbackLength = Math.hypot(fallbackDirectionX, fallbackDirectionZ);
  const safeFallbackX = fallbackLength > PLAYER_COLLISION_EPSILON ? fallbackDirectionX / fallbackLength : 1;
  const safeFallbackZ = fallbackLength > PLAYER_COLLISION_EPSILON ? fallbackDirectionZ / fallbackLength : 0;

  for (let pass = 0; pass < PLAYER_COLLISION_RESOLVE_PASSES; pass += 1) {
    let hadOverlap = false;

    for (const otherPlayer of Object.values(options.players)) {
      if (otherPlayer.sessionId === options.sessionId) {
        continue;
      }

      const verticalDistance = Math.abs(options.desiredY - otherPlayer.y);
      if (verticalDistance > PLAYER_COLLISION_HEIGHT) {
        continue;
      }

      const deltaX = resolvedX - otherPlayer.x;
      const deltaZ = resolvedZ - otherPlayer.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared >= PLAYER_COLLISION_MIN_DISTANCE_SQUARED) {
        continue;
      }

      const safeDistance = Math.sqrt(Math.max(distanceSquared, PLAYER_COLLISION_EPSILON));
      const normalX = safeDistance > PLAYER_COLLISION_EPSILON ? deltaX / safeDistance : safeFallbackX;
      const normalZ = safeDistance > PLAYER_COLLISION_EPSILON ? deltaZ / safeDistance : safeFallbackZ;
      const penetrationDepth = PLAYER_COLLISION_MIN_DISTANCE - safeDistance;
      if (penetrationDepth <= 0) {
        continue;
      }

      resolvedX += normalX * (penetrationDepth + 0.0001);
      resolvedZ += normalZ * (penetrationDepth + 0.0001);
      hadOverlap = true;
    }

    if (!hadOverlap) {
      break;
    }
  }

  return { x: resolvedX, z: resolvedZ };
}

export function ensureMovementState(
  movementStateBySessionId: Map<string, PlayerMovementState>,
  sessionId: string,
  now: number
): PlayerMovementState {
  const existing = movementStateBySessionId.get(sessionId);
  if (existing) {
    return existing;
  }

  const created = initializePlayerMovementState(now);
  movementStateBySessionId.set(sessionId, created);
  return created;
}

export function applyAuthoritativeMove(options: {
  player: MatchPlayerState;
  movementStateBySessionId: Map<string, PlayerMovementState>;
  moveIntent: NormalizedMoveIntent;
  players: Record<string, MatchPlayerState>;
  now: number;
}): {
  moved: boolean;
  locomotionChanged: boolean;
  x: number;
  y: number;
  z: number;
  rotationY: number;
} {
  const movementState = ensureMovementState(
    options.movementStateBySessionId,
    options.player.sessionId,
    options.now
  );

  const validatedMove = applyAuthoritativeMovementValidation({
    player: options.player,
    desiredX: options.moveIntent.x,
    desiredY: options.moveIntent.y,
    desiredZ: options.moveIntent.z,
    rotationY: options.moveIntent.rotationY,
    movementState,
    now: options.now
  });

  const resolvedMove = resolveHorizontalPlayerCollision({
    sessionId: options.player.sessionId,
    desiredX: validatedMove.x,
    desiredY: validatedMove.y,
    desiredZ: validatedMove.z,
    rotationY: validatedMove.rotationY,
    players: options.players
  });

  const moved =
    options.player.x !== resolvedMove.x ||
    options.player.y !== validatedMove.y ||
    options.player.z !== resolvedMove.z ||
    options.player.rotationY !== validatedMove.rotationY;

  const locomotionChanged =
    options.player.locomotionState !== options.moveIntent.locomotionState ||
    options.player.isCrouching !== options.moveIntent.isCrouching ||
    options.player.isSliding !== options.moveIntent.isSliding ||
    options.player.isWallRunning !== options.moveIntent.isWallRunning ||
    options.player.wallRunSide !== options.moveIntent.wallRunSide ||
    options.player.verticalVelocity !== options.moveIntent.verticalVelocity;

  if (moved) {
    options.player.x = resolvedMove.x;
    options.player.y = validatedMove.y;
    options.player.z = resolvedMove.z;
    options.player.rotationY = validatedMove.rotationY;
  }

  if (moved || locomotionChanged) {
    options.player.locomotionState = options.moveIntent.locomotionState;
    options.player.isCrouching = options.moveIntent.isCrouching;
    options.player.isSliding = options.moveIntent.isSliding;
    options.player.isWallRunning = options.moveIntent.isWallRunning;
    options.player.wallRunSide = options.moveIntent.wallRunSide;
    options.player.verticalVelocity = options.moveIntent.verticalVelocity;
  }

  return {
    moved,
    locomotionChanged,
    x: options.player.x,
    y: options.player.y,
    z: options.player.z,
    rotationY: options.player.rotationY
  };
}
