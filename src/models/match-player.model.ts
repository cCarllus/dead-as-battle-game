// Responsável por tipar payloads e estado de jogadores sincronizados na sala global_match.
export type MatchPlayerLocomotionState =
  | "Idle"
  | "Walk"
  | "Run"
  | "JumpStart"
  | "InAir"
  | "Fall"
  | "Land"
  | "Crouch"
  | "CrouchWalk"
  | "Slide"
  | "WallRun"
  | "DoubleJump"
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
  isSliding: boolean;
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

export type MatchSnapshotPayload = {
  players: Record<string, MatchPlayerState>;
};

export type MatchPlayerJoinedPayload = {
  player: MatchPlayerState;
};

export type MatchPlayerLeftPayload = {
  sessionId: string;
  userId?: string;
  leftAt?: number;
};

export type MatchPlayerMovedPayload = {
  sessionId: string;
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

export type MatchCombatHitPayload = {
  attackerSessionId: string;
  targetSessionId: string;
  damage: number;
  comboHitIndex: number;
  wasBlocked: boolean;
  didGuardBreak: boolean;
};

export type MatchCombatBlockPayload = {
  attackerSessionId: string;
  targetSessionId: string;
  comboHitIndex: number;
  guardDamage: number;
  currentGuard: number;
  maxGuard: number;
  didGuardBreak: boolean;
};

export type MatchCombatGuardBreakPayload = {
  attackerSessionId: string;
  targetSessionId: string;
  guardBreakDurationMs: number;
};

export type MatchCombatStatePayload = {
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

export type MatchCombatKillPayload = {
  killerSessionId: string;
  victimSessionId: string;
  killerKills: number;
  victimDeaths: number;
};

export type MatchCombatUltimatePayload = {
  sessionId: string;
  characterId: string;
  durationMs: number;
  startedAt: number;
  endsAt: number;
};
