// Responsável por validar bloqueio frontal, durabilidade de guarda, guard break e regeneração autoritativa.
import type { MatchPlayerState } from "../models/match-player.model.js";
import { clamp } from "../utils/math.js";

export const BLOCK_GUARD_CONFIG = {
  maxGuard: 100,
  maxBlockHoldDurationMs: 2500,
  guardBreakStunMs: 1000,
  guardRegenDelayMs: 1000,
  guardRegenPerSecond: 20,
  blockFrontConeAngleDegrees: 120,
  guardDamageByComboIndex: {
    1: 20,
    2: 25,
    3: 35
  }
} as const;

export type GuardDamageResult = {
  guardDamageApplied: number;
  didGuardBreak: boolean;
  currentGuard: number;
};

function resolveForwardVector(rotationY: number): { x: number; z: number } {
  return {
    x: Math.sin(rotationY),
    z: Math.cos(rotationY)
  };
}

function normalize2D(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  if (length <= 0.000001) {
    return { x: 0, z: 0 };
  }

  return {
    x: x / length,
    z: z / length
  };
}

function isPlayerFacingAttackerFrontally(target: MatchPlayerState, attacker: MatchPlayerState): boolean {
  const toAttackerX = attacker.x - target.x;
  const toAttackerZ = attacker.z - target.z;
  const directionToAttacker = normalize2D(toAttackerX, toAttackerZ);
  if (directionToAttacker.x === 0 && directionToAttacker.z === 0) {
    return true;
  }

  const targetForward = resolveForwardVector(target.rotationY);
  const normalizedForward = normalize2D(targetForward.x, targetForward.z);
  const dot = normalizedForward.x * directionToAttacker.x + normalizedForward.z * directionToAttacker.z;
  const minDot = Math.cos((BLOCK_GUARD_CONFIG.blockFrontConeAngleDegrees * Math.PI) / 360);

  return dot >= minDot;
}

export function initializeGuardState(player: MatchPlayerState, now: number): void {
  player.maxGuard = BLOCK_GUARD_CONFIG.maxGuard;
  player.currentGuard = BLOCK_GUARD_CONFIG.maxGuard;
  player.isBlocking = false;
  player.blockStartedAt = 0;
  player.isGuardBroken = false;
  player.stunUntil = 0;
  player.lastGuardDamagedAt = now;
}

export function canUseCombatActions(player: MatchPlayerState, now: number): boolean {
  return player.isAlive && !player.isGuardBroken && now >= player.stunUntil;
}

export function canStartBlock(player: MatchPlayerState, now: number): boolean {
  if (!canUseCombatActions(player, now)) {
    return false;
  }

  if (player.isAttacking) {
    return false;
  }

  return true;
}

export function startBlock(player: MatchPlayerState, now: number): boolean {
  if (player.isBlocking) {
    return false;
  }

  if (!canStartBlock(player, now)) {
    return false;
  }

  player.isBlocking = true;
  player.blockStartedAt = now;
  player.isSprinting = false;
  return true;
}

export function endBlock(player: MatchPlayerState): boolean {
  if (!player.isBlocking) {
    return false;
  }

  player.isBlocking = false;
  player.blockStartedAt = 0;
  return true;
}

export function enforceMaxBlockHoldDuration(player: MatchPlayerState, now: number): boolean {
  if (!player.isBlocking) {
    return false;
  }

  if (now - player.blockStartedAt < BLOCK_GUARD_CONFIG.maxBlockHoldDurationMs) {
    return false;
  }

  return endBlock(player);
}

export function canBlockIncomingHit(target: MatchPlayerState, attacker: MatchPlayerState, now: number): boolean {
  if (!target.isAlive || !attacker.isAlive) {
    return false;
  }

  if (!target.isBlocking || target.isGuardBroken) {
    return false;
  }

  if (now < target.stunUntil) {
    return false;
  }

  return isPlayerFacingAttackerFrontally(target, attacker);
}

export function resolveGuardDamageForCombo(comboHitIndex: number): number {
  const safeComboHitIndex = Math.max(1, Math.min(3, Math.floor(comboHitIndex)));
  return BLOCK_GUARD_CONFIG.guardDamageByComboIndex[
    safeComboHitIndex as keyof typeof BLOCK_GUARD_CONFIG.guardDamageByComboIndex
  ];
}

export function applyBlockedHitToGuard(
  target: MatchPlayerState,
  comboHitIndex: number,
  now: number
): GuardDamageResult {
  const guardDamage = resolveGuardDamageForCombo(comboHitIndex);
  const previousGuard = target.currentGuard;
  const nextGuard = clamp(previousGuard - guardDamage, 0, target.maxGuard);
  target.currentGuard = nextGuard;
  target.lastGuardDamagedAt = now;

  let didGuardBreak = false;

  if (nextGuard <= 0) {
    didGuardBreak = !target.isGuardBroken;
    target.isGuardBroken = true;
    target.isBlocking = false;
    target.blockStartedAt = 0;
    target.stunUntil = Math.max(target.stunUntil, now + BLOCK_GUARD_CONFIG.guardBreakStunMs);
  }

  return {
    guardDamageApplied: Math.max(0, previousGuard - nextGuard),
    didGuardBreak,
    currentGuard: target.currentGuard
  };
}

export function tickGuardState(player: MatchPlayerState, deltaSeconds: number, now: number): boolean {
  let changed = false;

  if (enforceMaxBlockHoldDuration(player, now)) {
    changed = true;
  }

  if (!player.isAlive) {
    if (player.isBlocking || player.isAttacking || player.isSprinting) {
      player.isBlocking = false;
      player.isAttacking = false;
      player.isSprinting = false;
      changed = true;
    }
    return changed;
  }

  if (player.isBlocking) {
    return changed;
  }

  const canRegen = now - player.lastGuardDamagedAt >= BLOCK_GUARD_CONFIG.guardRegenDelayMs;
  if (!canRegen) {
    return changed;
  }

  if (deltaSeconds > 0 && player.currentGuard < player.maxGuard) {
    const previousGuard = player.currentGuard;
    player.currentGuard = clamp(
      previousGuard + BLOCK_GUARD_CONFIG.guardRegenPerSecond * deltaSeconds,
      0,
      player.maxGuard
    );

    if (player.currentGuard !== previousGuard) {
      changed = true;
    }
  }

  if (player.isGuardBroken && now >= player.stunUntil && player.currentGuard > 0) {
    player.isGuardBroken = false;
    changed = true;
  }

  return changed;
}
