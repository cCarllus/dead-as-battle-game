// Shared helpers for snapshotting and comparing combat-relevant MatchPlayerState fields.
import type { MatchPlayerState } from "./match-player.model.js";

export type PlayerCombatSnapshot = Pick<
  MatchPlayerState,
  | "x"
  | "y"
  | "z"
  | "currentHealth"
  | "maxHealth"
  | "isAlive"
  | "isAttacking"
  | "attackComboIndex"
  | "lastAttackAt"
  | "combatState"
  | "combatStateStartedAt"
  | "combatStateEndsAt"
  | "attackPhase"
  | "activeActionId"
  | "activeSkillId"
  | "queuedAttack"
  | "lastDamagedAt"
  | "deadAt"
  | "respawnAvailableAt"
  | "isBlocking"
  | "blockStartedAt"
  | "maxGuard"
  | "currentGuard"
  | "isGuardBroken"
  | "stunUntil"
  | "lastGuardDamagedAt"
  | "ultimateCharge"
  | "ultimateMax"
  | "isUltimateReady"
  | "isUsingUltimate"
  | "ultimateStartedAt"
  | "ultimateEndsAt"
>;

export function snapshotCombatState(player: MatchPlayerState): PlayerCombatSnapshot {
  return {
    x: player.x,
    y: player.y,
    z: player.z,
    currentHealth: player.currentHealth,
    maxHealth: player.maxHealth,
    isAlive: player.isAlive,
    isAttacking: player.isAttacking,
    attackComboIndex: player.attackComboIndex,
    lastAttackAt: player.lastAttackAt,
    combatState: player.combatState,
    combatStateStartedAt: player.combatStateStartedAt,
    combatStateEndsAt: player.combatStateEndsAt,
    attackPhase: player.attackPhase,
    activeActionId: player.activeActionId,
    activeSkillId: player.activeSkillId,
    queuedAttack: player.queuedAttack,
    lastDamagedAt: player.lastDamagedAt,
    deadAt: player.deadAt,
    respawnAvailableAt: player.respawnAvailableAt,
    isBlocking: player.isBlocking,
    blockStartedAt: player.blockStartedAt,
    maxGuard: player.maxGuard,
    currentGuard: player.currentGuard,
    isGuardBroken: player.isGuardBroken,
    stunUntil: player.stunUntil,
    lastGuardDamagedAt: player.lastGuardDamagedAt,
    ultimateCharge: player.ultimateCharge,
    ultimateMax: player.ultimateMax,
    isUltimateReady: player.isUltimateReady,
    isUsingUltimate: player.isUsingUltimate,
    ultimateStartedAt: player.ultimateStartedAt,
    ultimateEndsAt: player.ultimateEndsAt
  };
}

export function didCombatStateChange(previous: PlayerCombatSnapshot, current: MatchPlayerState): boolean {
  return (
    previous.x !== current.x ||
    previous.y !== current.y ||
    previous.z !== current.z ||
    previous.currentHealth !== current.currentHealth ||
    previous.maxHealth !== current.maxHealth ||
    previous.isAlive !== current.isAlive ||
    previous.isAttacking !== current.isAttacking ||
    previous.attackComboIndex !== current.attackComboIndex ||
    previous.lastAttackAt !== current.lastAttackAt ||
    previous.combatState !== current.combatState ||
    previous.combatStateStartedAt !== current.combatStateStartedAt ||
    previous.combatStateEndsAt !== current.combatStateEndsAt ||
    previous.attackPhase !== current.attackPhase ||
    previous.activeActionId !== current.activeActionId ||
    previous.activeSkillId !== current.activeSkillId ||
    previous.queuedAttack !== current.queuedAttack ||
    previous.lastDamagedAt !== current.lastDamagedAt ||
    previous.deadAt !== current.deadAt ||
    previous.respawnAvailableAt !== current.respawnAvailableAt ||
    previous.isBlocking !== current.isBlocking ||
    previous.blockStartedAt !== current.blockStartedAt ||
    previous.maxGuard !== current.maxGuard ||
    previous.currentGuard !== current.currentGuard ||
    previous.isGuardBroken !== current.isGuardBroken ||
    previous.stunUntil !== current.stunUntil ||
    previous.lastGuardDamagedAt !== current.lastGuardDamagedAt ||
    previous.ultimateCharge !== current.ultimateCharge ||
    previous.ultimateMax !== current.ultimateMax ||
    previous.isUltimateReady !== current.isUltimateReady ||
    previous.isUsingUltimate !== current.isUsingUltimate ||
    previous.ultimateStartedAt !== current.ultimateStartedAt ||
    previous.ultimateEndsAt !== current.ultimateEndsAt
  );
}
