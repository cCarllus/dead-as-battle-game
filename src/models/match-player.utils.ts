// Shared pure helpers for cloning and comparing MatchPlayerState instances.
import type { MatchPlayerState } from "./match-player.model";

export function cloneMatchPlayerState(player: MatchPlayerState): MatchPlayerState {
  return {
    sessionId: player.sessionId,
    userId: player.userId,
    nickname: player.nickname,
    heroId: player.heroId,
    heroLevel: player.heroLevel,
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY,
    kills: player.kills,
    deaths: player.deaths,
    maxHealth: player.maxHealth,
    currentHealth: player.currentHealth,
    isAlive: player.isAlive,
    ultimateCharge: player.ultimateCharge,
    ultimateMax: player.ultimateMax,
    isUltimateReady: player.isUltimateReady,
    isUsingUltimate: player.isUsingUltimate,
    ultimateStartedAt: player.ultimateStartedAt,
    ultimateEndsAt: player.ultimateEndsAt,
    maxStamina: player.maxStamina,
    currentStamina: player.currentStamina,
    isSprinting: player.isSprinting,
    locomotionState: player.locomotionState,
    isCrouching: player.isCrouching,
    isRolling: player.isRolling,
    isWallRunning: player.isWallRunning,
    wallRunSide: player.wallRunSide,
    verticalVelocity: player.verticalVelocity,
    sprintBlocked: player.sprintBlocked,
    lastSprintEndedAt: player.lastSprintEndedAt,
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
    skillCooldowns: { ...player.skillCooldowns },
    isBlocking: player.isBlocking,
    blockStartedAt: player.blockStartedAt,
    maxGuard: player.maxGuard,
    currentGuard: player.currentGuard,
    isGuardBroken: player.isGuardBroken,
    stunUntil: player.stunUntil,
    lastGuardDamagedAt: player.lastGuardDamagedAt,
    joinedAt: player.joinedAt
  };
}

export function hasMatchPlayerStateChanged(
  previous: MatchPlayerState | undefined,
  next: MatchPlayerState
): boolean {
  if (!previous) {
    return true;
  }

  return (
    previous.x !== next.x ||
    previous.y !== next.y ||
    previous.z !== next.z ||
    previous.rotationY !== next.rotationY ||
    previous.isSprinting !== next.isSprinting ||
    previous.locomotionState !== next.locomotionState ||
    previous.isCrouching !== next.isCrouching ||
    previous.isRolling !== next.isRolling ||
    previous.isWallRunning !== next.isWallRunning ||
    previous.wallRunSide !== next.wallRunSide ||
    previous.verticalVelocity !== next.verticalVelocity ||
    previous.isAttacking !== next.isAttacking ||
    previous.attackComboIndex !== next.attackComboIndex ||
    previous.lastAttackAt !== next.lastAttackAt ||
    previous.combatState !== next.combatState ||
    previous.combatStateStartedAt !== next.combatStateStartedAt ||
    previous.combatStateEndsAt !== next.combatStateEndsAt ||
    previous.attackPhase !== next.attackPhase ||
    previous.activeActionId !== next.activeActionId ||
    previous.activeSkillId !== next.activeSkillId ||
    previous.queuedAttack !== next.queuedAttack ||
    previous.lastDamagedAt !== next.lastDamagedAt ||
    previous.deadAt !== next.deadAt ||
    previous.respawnAvailableAt !== next.respawnAvailableAt ||
    previous.isBlocking !== next.isBlocking ||
    previous.blockStartedAt !== next.blockStartedAt ||
    previous.maxGuard !== next.maxGuard ||
    previous.currentGuard !== next.currentGuard ||
    previous.isGuardBroken !== next.isGuardBroken ||
    previous.stunUntil !== next.stunUntil ||
    previous.lastGuardDamagedAt !== next.lastGuardDamagedAt ||
    JSON.stringify(previous.skillCooldowns) !== JSON.stringify(next.skillCooldowns) ||
    previous.isUsingUltimate !== next.isUsingUltimate ||
    previous.ultimateStartedAt !== next.ultimateStartedAt ||
    previous.ultimateEndsAt !== next.ultimateEndsAt ||
    previous.isAlive !== next.isAlive ||
    previous.nickname !== next.nickname ||
    previous.heroId !== next.heroId ||
    previous.heroLevel !== next.heroLevel ||
    previous.joinedAt !== next.joinedAt ||
    previous.userId !== next.userId
  );
}
