// Responsável por orquestrar ataques melee, combo, dano, stun, knockback e integração com bloqueio/guarda.
import type {
  CombatBlockEventPayload,
  CombatGuardBreakEventPayload,
  CombatHitEventPayload,
  MatchPlayerState
} from "../models/match-player.model.js";
import { setHealth } from "./health.service.js";
import {
  applyBlockedHitToGuard,
  BLOCK_GUARD_CONFIG,
  canBlockIncomingHit,
  canUseCombatActions,
  endBlock,
  startBlock,
  tickGuardState
} from "./block-guard.service.js";
import { applyLightKnockback, pickBestMeleeTarget } from "./melee-hit.service.js";

export const COMBAT_CONFIG = {
  comboResetTimeMs: 1000,
  attackIntervalMs: 300,
  attackAnimationWindowMs: 260,
  damageByComboIndex: {
    1: 20,
    2: 30,
    3: 50
  },
  stunByComboIndexMs: {
    1: 120,
    2: 150,
    3: 220
  },
  knockbackByComboIndex: {
    1: 0.35,
    2: 0.5,
    3: 0.72
  }
} as const;

type ComboHitIndex = 1 | 2 | 3;

export type AttackResolution = {
  stateChanged: boolean;
  hitEvent: CombatHitEventPayload | null;
  blockEvent: CombatBlockEventPayload | null;
  guardBreakEvent: CombatGuardBreakEventPayload | null;
};

function asComboHitIndex(value: number): ComboHitIndex {
  const normalized = Math.max(1, Math.min(3, Math.floor(value)));
  return normalized as ComboHitIndex;
}

function resolveComboDamage(comboHitIndex: ComboHitIndex): number {
  return COMBAT_CONFIG.damageByComboIndex[comboHitIndex];
}

function resolveComboStunMs(comboHitIndex: ComboHitIndex): number {
  return COMBAT_CONFIG.stunByComboIndexMs[comboHitIndex];
}

function resolveComboKnockback(comboHitIndex: ComboHitIndex): number {
  return COMBAT_CONFIG.knockbackByComboIndex[comboHitIndex];
}

function resolveNextComboHitIndex(player: MatchPlayerState, now: number): ComboHitIndex {
  const shouldResetCombo =
    player.attackComboIndex <= 0 ||
    now - player.lastAttackAt > COMBAT_CONFIG.comboResetTimeMs;

  if (shouldResetCombo) {
    return 1;
  }

  const nextIndex = (player.attackComboIndex % 3) + 1;
  return asComboHitIndex(nextIndex);
}

function canStartAttack(player: MatchPlayerState, now: number): boolean {
  if (!canUseCombatActions(player, now)) {
    return false;
  }

  if (player.isBlocking) {
    return false;
  }

  const elapsedSinceLastAttack = now - player.lastAttackAt;
  return elapsedSinceLastAttack >= COMBAT_CONFIG.attackIntervalMs;
}

function applyHitStun(target: MatchPlayerState, comboHitIndex: ComboHitIndex, now: number): void {
  target.stunUntil = Math.max(target.stunUntil, now + resolveComboStunMs(comboHitIndex));
}

function updateAttackingFlag(player: MatchPlayerState, now: number): boolean {
  const shouldBeAttacking = now - player.lastAttackAt <= COMBAT_CONFIG.attackAnimationWindowMs;
  if (player.isAttacking === shouldBeAttacking) {
    return false;
  }

  player.isAttacking = shouldBeAttacking;
  return true;
}

export function handleAttackStart(options: {
  attacker: MatchPlayerState;
  players: Record<string, MatchPlayerState>;
  now: number;
}): AttackResolution {
  const { attacker, players, now } = options;

  if (!canStartAttack(attacker, now)) {
    return {
      stateChanged: false,
      hitEvent: null,
      blockEvent: null,
      guardBreakEvent: null
    };
  }

  endBlock(attacker);
  attacker.isSprinting = false;

  const comboHitIndex = resolveNextComboHitIndex(attacker, now);
  attacker.attackComboIndex = comboHitIndex;
  attacker.lastAttackAt = now;
  attacker.isAttacking = true;

  const target = pickBestMeleeTarget(attacker, Object.values(players));
  if (!target) {
    return {
      stateChanged: true,
      hitEvent: null,
      blockEvent: null,
      guardBreakEvent: null
    };
  }

  const blocked = canBlockIncomingHit(target, attacker, now);
  if (blocked) {
    const guardResult = applyBlockedHitToGuard(target, comboHitIndex, now);

    return {
      stateChanged: true,
      hitEvent: {
        attackerSessionId: attacker.sessionId,
        targetSessionId: target.sessionId,
        damage: 0,
        comboHitIndex,
        wasBlocked: true,
        didGuardBreak: guardResult.didGuardBreak
      },
      blockEvent: {
        attackerSessionId: attacker.sessionId,
        targetSessionId: target.sessionId,
        comboHitIndex,
        guardDamage: guardResult.guardDamageApplied,
        currentGuard: target.currentGuard,
        maxGuard: target.maxGuard,
        didGuardBreak: guardResult.didGuardBreak
      },
      guardBreakEvent: guardResult.didGuardBreak
        ? {
            attackerSessionId: attacker.sessionId,
            targetSessionId: target.sessionId,
            guardBreakDurationMs: BLOCK_GUARD_CONFIG.guardBreakStunMs
          }
        : null
    };
  }

  const damage = resolveComboDamage(comboHitIndex);
  const nextHealth = target.currentHealth - damage;
  setHealth(target, nextHealth);
  target.isBlocking = false;
  target.blockStartedAt = 0;

  applyHitStun(target, comboHitIndex, now);
  applyLightKnockback(attacker, target, resolveComboKnockback(comboHitIndex));

  return {
    stateChanged: true,
    hitEvent: {
      attackerSessionId: attacker.sessionId,
      targetSessionId: target.sessionId,
      damage,
      comboHitIndex,
      wasBlocked: false,
      didGuardBreak: false
    },
    blockEvent: null,
    guardBreakEvent: null
  };
}

export function handleBlockStart(player: MatchPlayerState, now: number): boolean {
  return startBlock(player, now);
}

export function handleBlockEnd(player: MatchPlayerState): boolean {
  return endBlock(player);
}

export function tickCombatState(players: Record<string, MatchPlayerState>, deltaSeconds: number, now: number): boolean {
  let changed = false;

  Object.values(players).forEach((player) => {
    if (updateAttackingFlag(player, now)) {
      changed = true;
    }

    if (player.attackComboIndex > 0 && now - player.lastAttackAt > COMBAT_CONFIG.comboResetTimeMs) {
      player.attackComboIndex = 0;
      changed = true;
    }

    if (tickGuardState(player, deltaSeconds, now)) {
      changed = true;
    }

    if (!player.isAlive && (player.isBlocking || player.isAttacking)) {
      player.isBlocking = false;
      player.isAttacking = false;
      changed = true;
    }
  });

  return changed;
}
