// Responsável por tipar o estado de presença e combate dos jogadores dentro da sala de partida global.
export type MatchPlayerState = {
  sessionId: string;
  userId: string;
  nickname: string;
  heroId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  maxHealth: number;
  currentHealth: number;
  isAlive: boolean;
  ultimateCharge: number;
  ultimateMax: number;
  isUltimateReady: boolean;
  maxStamina: number;
  currentStamina: number;
  isSprinting: boolean;
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
};

export type MatchMovePayload = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
  rotationY?: unknown;
};

export type MatchSprintIntentPayload = {
  isShiftPressed?: unknown;
  isForwardPressed?: unknown;
};

export type MatchUltimateActivatePayload = Record<string, never>;

export type MatchAttackStartPayload = Record<string, never>;

export type MatchBlockStartPayload = Record<string, never>;

export type MatchBlockEndPayload = Record<string, never>;

export type MatchRespawnRequestPayload = Record<string, never>;

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
