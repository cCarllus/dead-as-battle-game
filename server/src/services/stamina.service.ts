// Responsável por concentrar regras de stamina/sprint autoritativas por jogador.
import type { MatchPlayerState } from "../models/match-player.model.js";

export type SprintInputState = {
  isShiftPressed: boolean;
  isForwardPressed: boolean;
};

export const STAMINA_CONFIG = {
  maxStamina: 100,
  staminaDrainRate: 20,
  staminaRegenRate: 15,
  staminaRegenDelayMs: 1500,
  sprintRecoveryThreshold: 20
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDeltaTime(deltaTime: number): number {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
    return 0;
  }

  return deltaTime;
}

export function initializeStamina(player: MatchPlayerState, now: number = Date.now()): void {
  player.maxStamina = STAMINA_CONFIG.maxStamina;
  player.currentStamina = STAMINA_CONFIG.maxStamina;
  player.isSprinting = false;
  player.sprintBlocked = false;
  player.lastSprintEndedAt = now;
}

export function canSprint(player: MatchPlayerState, inputState: SprintInputState): boolean {
  return (
    player.isAlive &&
    inputState.isForwardPressed &&
    inputState.isShiftPressed &&
    !player.sprintBlocked &&
    player.currentStamina > 0
  );
}

export function consumeStamina(player: MatchPlayerState, deltaTime: number): void {
  const safeDeltaTime = normalizeDeltaTime(deltaTime);
  if (safeDeltaTime <= 0) {
    return;
  }

  player.currentStamina = clamp(
    player.currentStamina - STAMINA_CONFIG.staminaDrainRate * safeDeltaTime,
    0,
    player.maxStamina
  );
}

export function regenerateStamina(player: MatchPlayerState, deltaTime: number, now: number): void {
  const safeDeltaTime = normalizeDeltaTime(deltaTime);
  if (safeDeltaTime <= 0) {
    return;
  }

  const msSinceLastSprintEnded = now - player.lastSprintEndedAt;
  if (msSinceLastSprintEnded < STAMINA_CONFIG.staminaRegenDelayMs) {
    return;
  }

  player.currentStamina = clamp(
    player.currentStamina + STAMINA_CONFIG.staminaRegenRate * safeDeltaTime,
    0,
    player.maxStamina
  );
}

export function blockSprintIfNeeded(player: MatchPlayerState): void {
  if (player.currentStamina > 0) {
    return;
  }

  player.currentStamina = 0;
  player.sprintBlocked = true;
  player.isSprinting = false;
}

export function unlockSprintIfRecovered(player: MatchPlayerState): void {
  if (!player.sprintBlocked) {
    return;
  }

  if (player.currentStamina > STAMINA_CONFIG.sprintRecoveryThreshold) {
    player.sprintBlocked = false;
  }
}

export function updateSprintState(
  player: MatchPlayerState,
  inputState: SprintInputState,
  deltaTime: number,
  now: number
): void {
  const wasSprinting = player.isSprinting;
  const shouldSprint = canSprint(player, inputState);

  if (shouldSprint) {
    player.isSprinting = true;
    consumeStamina(player, deltaTime);
    blockSprintIfNeeded(player);
  } else {
    player.isSprinting = false;
  }

  if (wasSprinting && !player.isSprinting) {
    player.lastSprintEndedAt = now;
  }

  if (!player.isSprinting) {
    blockSprintIfNeeded(player);
    regenerateStamina(player, deltaTime, now);
    unlockSprintIfRecovered(player);
  }
}
