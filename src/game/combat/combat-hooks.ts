// Responsável por padronizar o contrato de hooks de combate consumidos pela camada de locomoção/animação.
export type CombatHookState = {
  isAlive: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  attackComboIndex: 0 | 1 | 2 | 3;
  isStunned: boolean;
};

export function isCombatMovementLocked(state: CombatHookState): boolean {
  if (!state.isAlive) {
    return true;
  }

  if (state.isStunned) {
    return true;
  }

  return state.attackComboIndex > 0;
}

