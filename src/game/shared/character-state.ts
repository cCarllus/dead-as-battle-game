// Responsável por centralizar estados canônicos de locomoção compartilhados entre runtime, UI e sincronização.
export const CHARACTER_LOCOMOTION_STATES = [
  "Idle",
  "Grounded",
  "Walk",
  "Run",
  "Running",
  "JumpStart",
  "Jumping",
  "InAir",
  "Fall",
  "Falling",
  "Crouch",
  "Rolling",
  "WallRun",
  "DoubleJump",
  "LedgeHang",
  "Hanging",
  "LedgeClimb",
  "ClimbingUp",
  "MantlingLowObstacle",
  "Attack",
  "Block",
  "Hit",
  "Stunned",
  "Dead"
] as const;

export type CharacterLocomotionState = (typeof CHARACTER_LOCOMOTION_STATES)[number];

export const CHARACTER_LOCOMOTION_STATE_SET: ReadonlySet<CharacterLocomotionState> = new Set(
  CHARACTER_LOCOMOTION_STATES
);

export const WALL_RUN_SIDES = ["none", "left", "right"] as const;

export type WallRunSide = (typeof WALL_RUN_SIDES)[number];

export const WALL_RUN_SIDE_SET: ReadonlySet<WallRunSide> = new Set(WALL_RUN_SIDES);

export function isCharacterLocomotionState(value: unknown): value is CharacterLocomotionState {
  return typeof value === "string" && CHARACTER_LOCOMOTION_STATE_SET.has(value as CharacterLocomotionState);
}

export function isWallRunSide(value: unknown): value is WallRunSide {
  return typeof value === "string" && WALL_RUN_SIDE_SET.has(value as WallRunSide);
}
