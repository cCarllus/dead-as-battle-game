// Responsável por tipar o espelho cliente das definições de combate usadas na predição local.
export type CombatRuntimeState =
  | "CombatIdle"
  | "AttackWindup"
  | "AttackActive"
  | "AttackRecovery"
  | "HitReact"
  | "SkillCast"
  | "Dead"
  | "Block";

export type CombatAttackPhase = "None" | "Windup" | "Active" | "Recovery";

export type CombatSkillSlot = 1 | 2 | 3 | 4 | 5;

export type CombatComboIndex = 1 | 2 | 3;

export type CombatActionDefinition = {
  id: string;
  kind: "basicAttack" | "skill";
  skillSlot?: CombatSkillSlot;
  skillId?: string;
  comboIndex?: CombatComboIndex;
  animationCommand: string;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  comboQueueWindowMs: number;
  cooldownMs: number;
  movementLock: "full" | "partial" | "none";
};

export type CombatKitDefinition = {
  comboResetTimeMs: number;
  basicAttacks: readonly CombatActionDefinition[];
  skillsBySlot: Readonly<Record<CombatSkillSlot, CombatActionDefinition>>;
};
