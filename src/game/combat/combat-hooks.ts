// Responsável por padronizar o contrato de hooks de combate consumidos pela camada de locomoção/animação.
export type CombatHookState = {
  isAlive: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  combatState: "CombatIdle" | "AttackWindup" | "AttackActive" | "AttackRecovery" | "HitReact" | "SkillCast" | "Dead" | "Block";
  attackPhase: "None" | "Windup" | "Active" | "Recovery";
  attackComboIndex: 0 | 1 | 2 | 3;
  activeSkillId: string;
  isStunned: boolean;
};

export function isCombatMovementLocked(state: CombatHookState): boolean {
  if (!state.isAlive) {
    return true;
  }

  if (state.isStunned) {
    return true;
  }

  return (
    state.attackComboIndex > 0 ||
    state.combatState === "SkillCast" ||
    state.combatState === "AttackWindup" ||
    state.combatState === "AttackActive" ||
    state.combatState === "AttackRecovery"
  );
}
