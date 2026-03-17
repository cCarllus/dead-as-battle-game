// Responsável por tipar estados, ações e kits data-driven consumidos pelo combate autoritativo.
export const COMBAT_STATE_NAMES = [
  "CombatIdle",
  "AttackWindup",
  "AttackActive",
  "AttackRecovery",
  "HitReact",
  "SkillCast",
  "Dead",
  "Block"
] as const;

export type CombatStateName = (typeof COMBAT_STATE_NAMES)[number];

export const COMBAT_ATTACK_PHASES = ["None", "Windup", "Active", "Recovery"] as const;

export type CombatAttackPhase = (typeof COMBAT_ATTACK_PHASES)[number];

export type CombatDamageSourceType = "basic_melee" | "skill" | "ultimate" | "environment";

export type CombatTargetingShape = "melee_cone" | "projectile_line" | "self_aoe";

export type CombatActionKind = "basicAttack" | "skill";

export type CombatMovementLockMode = "full" | "partial" | "none";

export type CombatSkillSlot = 1 | 2 | 3 | 4 | 5;

export type CombatComboIndex = 1 | 2 | 3;

export type CombatHitBurstDefinition = {
  offsetMs: number;
};

export type CombatActionDefinition = {
  id: string;
  kind: CombatActionKind;
  sourceType: CombatDamageSourceType;
  animationCommand: string;
  comboIndex?: CombatComboIndex;
  skillSlot?: CombatSkillSlot;
  skillId?: string;
  damage: number;
  range: number;
  angleDegrees: number;
  radius: number;
  knockback: number;
  hitstunMs: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  comboQueueWindowMs: number;
  comboResetMs?: number;
  cooldownMs: number;
  interruptible: boolean;
  canQueueNextAttack: boolean;
  canBeInterrupted: boolean;
  movementLock: CombatMovementLockMode;
  targetingShape: CombatTargetingShape;
  isBlockable: boolean;
  hitBursts?: readonly CombatHitBurstDefinition[];
  vfxHook?: string | null;
  sfxHook?: string | null;
  ultimateChargeCost?: number;
};

export type CombatKitDefinition = {
  maxHealth: number;
  comboResetTimeMs: number;
  deathScreenDelayMs: number;
  ragdollDelayMs: number;
  respawnDelayMs: number;
  basicAttacks: readonly CombatActionDefinition[];
  skillsBySlot: Readonly<Record<CombatSkillSlot, CombatActionDefinition>>;
};
