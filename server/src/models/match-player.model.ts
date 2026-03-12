// Responsável por tipar o estado de presença e combate dos jogadores dentro da sala de partida global.
export type MatchPlayerLocomotionState =
  | "Idle"
  | "Walk"
  | "Run"
  | "JumpStart"
  | "InAir"
  | "Fall"
  | "Crouch"
  | "Rolling"
  | "WallRun"
  | "DoubleJump"
  | "LedgeHang"
  | "LedgeClimb"
  | "Attack"
  | "Block"
  | "Hit"
  | "Stunned"
  | "Dead";

export type MatchPlayerWallRunSide = "none" | "left" | "right";

export type MatchPlayerState = {
  sessionId: string;
  userId: string;
  nickname: string;
  heroId: string;
  heroLevel: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  kills: number;
  deaths: number;
  maxHealth: number;
  currentHealth: number;
  isAlive: boolean;
  ultimateCharge: number;
  ultimateMax: number;
  isUltimateReady: boolean;
  isUsingUltimate: boolean;
  ultimateStartedAt: number;
  ultimateEndsAt: number;
  maxStamina: number;
  currentStamina: number;
  isSprinting: boolean;
  locomotionState: MatchPlayerLocomotionState;
  isCrouching: boolean;
  isRolling: boolean;
  isWallRunning: boolean;
  wallRunSide: MatchPlayerWallRunSide;
  verticalVelocity: number;
  sprintBlocked: boolean;
  lastSprintEndedAt: number;
  isAttacking: boolean;
  attackComboIndex: number;
  lastAttackAt: number;
  isBlocking: boolean;
  blockStartedAt: number;
  maxGuard: number;
  currentGuard: number;
  isGuardBroken: boolean;
  stunUntil: number;
  lastGuardDamagedAt: number;
  joinedAt: number;
};

export type GlobalMatchState = {
  players: Record<string, MatchPlayerState>;
};

export type MatchJoinOptions = {
  userId?: unknown;
  nickname?: unknown;
  heroId?: unknown;
  heroLevel?: unknown;
};

export type MatchMovePayload = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
  rotationY?: unknown;
  locomotionState?: unknown;
  isCrouching?: unknown;
  isRolling?: unknown;
  isWallRunning?: unknown;
  wallRunSide?: unknown;
  verticalVelocity?: unknown;
};

export type MatchSprintIntentPayload = {
  isShiftPressed?: unknown;
  isForwardPressed?: unknown;
};

export type MatchPlayerMovedPayload = {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  locomotionState: MatchPlayerLocomotionState;
  isCrouching: boolean;
  isRolling: boolean;
  isWallRunning: boolean;
  wallRunSide: MatchPlayerWallRunSide;
  verticalVelocity: number;
};

export type MatchUltimateActivatePayload = Record<string, never>;

export type MatchAttackStartPayload = Record<string, never>;

export type MatchBlockStartPayload = Record<string, never>;

export type MatchBlockEndPayload = Record<string, never>;

export type MatchRespawnRequestPayload = Record<string, never>;

export type MatchAttackStartedEventPayload = {
  sessionId: string;
  attackComboIndex: number;
  startedAt: number;
};

export type MatchBlockStartedEventPayload = {
  sessionId: string;
  blockStartedAt: number;
};

export type MatchBlockEndedEventPayload = {
  sessionId: string;
  blockEndedAt: number;
};

export type MatchPlayerRespawnedEventPayload = {
  player: MatchPlayerState;
  respawnedAt: number;
};

export type CombatHitEventPayload = {
  attackerSessionId: string;
  targetSessionId: string;
  damage: number;
  comboHitIndex: number;
  wasBlocked: boolean;
  didGuardBreak: boolean;
};

export type CombatBlockEventPayload = {
  attackerSessionId: string;
  targetSessionId: string;
  comboHitIndex: number;
  guardDamage: number;
  currentGuard: number;
  maxGuard: number;
  didGuardBreak: boolean;
};

export type CombatGuardBreakEventPayload = {
  attackerSessionId: string;
  targetSessionId: string;
  guardBreakDurationMs: number;
};

export type CombatStateEventPayload = {
  sessionId: string;
  isAttacking: boolean;
  attackComboIndex: number;
  lastAttackAt: number;
  isBlocking: boolean;
  blockStartedAt: number;
  maxGuard: number;
  currentGuard: number;
  isGuardBroken: boolean;
  stunUntil: number;
  lastGuardDamagedAt: number;
  x: number;
  y: number;
  z: number;
};

export type CombatKillEventPayload = {
  killerSessionId: string;
  victimSessionId: string;
  killerName: string;
  victimName: string;
  killerKills: number;
  victimDeaths: number;
  timestamp: number;
};

export type CombatUltimateEventPayload = {
  sessionId: string;
  characterId: string;
  durationMs: number;
  startedAt: number;
  endsAt: number;
};
