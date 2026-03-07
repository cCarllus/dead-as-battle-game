// Responsável por encapsular regras de carga/consumo de ultimate no estado autoritativo do jogador.
import type { MatchPlayerState } from "../models/match-player.model.js";

export const DEFAULT_ULTIMATE_MAX = 100;

function clampUltimateCharge(value: number, ultimateMax: number): number {
  const safeUltimateMax = Math.max(1, Math.floor(ultimateMax));
  const safeValue = Math.floor(value);
  return Math.max(0, Math.min(safeUltimateMax, safeValue));
}

export function syncUltimateReady(player: MatchPlayerState): void {
  player.isUltimateReady = player.ultimateCharge >= player.ultimateMax;
}

export function resetUltimate(player: MatchPlayerState, ultimateMax: number = DEFAULT_ULTIMATE_MAX): void {
  const safeUltimateMax = Math.max(1, Math.floor(ultimateMax));
  player.ultimateMax = safeUltimateMax;
  player.ultimateCharge = 0;
  player.isUltimateReady = false;
}

export function addUltimateCharge(player: MatchPlayerState, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  player.ultimateCharge = clampUltimateCharge(player.ultimateCharge + amount, player.ultimateMax);
  syncUltimateReady(player);
}

export function consumeUltimate(player: MatchPlayerState): boolean {
  syncUltimateReady(player);
  if (!player.isUltimateReady) {
    return false;
  }

  player.ultimateCharge = 0;
  player.isUltimateReady = false;
  return true;
}
