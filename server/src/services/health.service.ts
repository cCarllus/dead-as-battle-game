// Responsável por encapsular regras de estado de vida do jogador para a sala autoritativa.
import type { MatchPlayerState } from "../models/match-player.model.js";

export const DEFAULT_MAX_HEALTH = 1000;

function clampHealth(value: number, maxHealth: number): number {
  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  const safeValue = Math.floor(value);
  return Math.max(0, Math.min(safeMaxHealth, safeValue));
}

export function resetHealth(player: MatchPlayerState, maxHealth: number = DEFAULT_MAX_HEALTH): void {
  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  player.maxHealth = safeMaxHealth;
  player.currentHealth = safeMaxHealth;
  player.isAlive = true;
}

export function setHealth(player: MatchPlayerState, value: number): void {
  player.currentHealth = clampHealth(value, player.maxHealth);
  player.isAlive = player.currentHealth > 0;
}

export function killPlayer(player: MatchPlayerState): void {
  player.currentHealth = 0;
  player.isAlive = false;
}
