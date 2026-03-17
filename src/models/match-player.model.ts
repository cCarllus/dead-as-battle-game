// Responsável por tipar payloads e estado de jogadores sincronizados na sala global_match.
import type { CharacterLocomotionState, WallRunSide } from "../game/shared/character-state";

export type MatchPlayerLocomotionState = CharacterLocomotionState;

export type MatchPlayerWallRunSide = WallRunSide;

export type MatchCombatStateName =
  | "CombatIdle"
  | "AttackWindup"
  | "AttackActive"
  | "AttackRecovery"
  | "HitReact"
  | "SkillCast"
  | "Dead"
  | "Block";

export type MatchCombatAttackPhase = "None" | "Windup" | "Active" | "Recovery";

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
  combatState: MatchCombatStateName;
  combatStateStartedAt: number;
  combatStateEndsAt: number;
  attackPhase: MatchCombatAttackPhase;
  activeActionId: string;
  activeSkillId: string;
  queuedAttack: boolean;
  lastDamagedAt: number;
  deadAt: number;
  respawnAvailableAt: number;
  skillCooldowns: Record<string, number>;
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
  isRolling: boolean;
  isWallRunning: boolean;
  wallRunSide: MatchPlayerWallRunSide;
  verticalVelocity: number;
};

export type MatchAttackStartedEventPayload = {
  sessionId: string;
  attackId: string;
  attackComboIndex: number;
  startedAt: number;
};

export type MatchSkillCastStartedEventPayload = {
  sessionId: string;
  skillId: string;
  skillSlot: number;
  startedAt: number;
  endsAt: number;
  cooldownEndsAt: number;
  isUltimate: boolean;
};

export type MatchSkillCastFinishedEventPayload = {
  sessionId: string;
  skillId: string;
  finishedAt: number;
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
  sourceType: "basic_melee" | "skill" | "ultimate" | "environment";
  sourceId: string;
  damage: number;
  comboHitIndex: number;
  wasBlocked: boolean;
  didGuardBreak: boolean;
  knockback: number;
  hitstunMs: number;
  targetHealth: number;
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
  combatState: MatchCombatStateName;
  combatStateStartedAt: number;
  combatStateEndsAt: number;
  attackPhase: MatchCombatAttackPhase;
  activeActionId: string;
  activeSkillId: string;
  isAttacking: boolean;
  attackComboIndex: number;
  lastAttackAt: number;
  queuedAttack: boolean;
  currentHealth: number;
  maxHealth: number;
  isAlive: boolean;
  lastDamagedAt: number;
  deadAt: number;
  respawnAvailableAt: number;
  skillCooldowns: Record<string, number>;
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
  killerName: string;
  victimName: string;
  killerKills: number;
  victimDeaths: number;
  timestamp: number;
};

export type MatchCombatUltimatePayload = {
  sessionId: string;
  characterId: string;
  skillId: string;
  durationMs: number;
  startedAt: number;
  endsAt: number;
};

export type MatchCombatPlayerDiedPayload = {
  sessionId: string;
  killerSessionId: string | null;
  deadAt: number;
  respawnAvailableAt: number;
};

export type MatchCombatRagdollPayload = {
  sessionId: string;
  enabledAt: number;
};
