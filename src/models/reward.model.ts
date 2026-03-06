// Responsável por constantes e contratos do sistema de recompensa de tempo ativo.
export const COIN_REWARD_AMOUNT = 25;
export const ACTIVE_REWARD_INTERVAL_SECONDS = 10 * 60;
export const MAX_PENDING_COIN_REWARDS = 3;

export type RewardComputationResult = {
  activePlayTimeSeconds: number;
  pendingCoinRewards: number;
  generatedRewards: number;
};
