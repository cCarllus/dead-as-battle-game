// Modelos e utilitários de estado da sala de partida para reduzir lógica na Room.
import type { GlobalMatchState, MatchPlayerState } from "./match-player.model.js";

export type MatchPlayerStructuredState = {
  sessionId: string;
  nickname: string;
  characterId: string;
  transform: {
    x: number;
    y: number;
    z: number;
    rotation: number;
  };
  combat: {
    health: number;
    maxHealth: number;
    guard: number;
    maxGuard: number;
    isBlocking: boolean;
    isAttacking: boolean;
    isGuardBroken: boolean;
    stunUntil: number;
  };
  stats: {
    kills: number;
    deaths: number;
  };
  abilities: {
    ultimateCharge: number;
    ultimateMax: number;
    isUsingUltimate: boolean;
    isUltimateReady: boolean;
    ultimateStartedAt: number;
    ultimateEndsAt: number;
  };
  locomotion: {
    state: MatchPlayerState["locomotionState"];
    isCrouching: boolean;
    isSliding: boolean;
    isWallRunning: boolean;
    wallRunSide: MatchPlayerState["wallRunSide"];
    verticalVelocity: number;
  };
};

export function toStructuredPlayerState(player: MatchPlayerState): MatchPlayerStructuredState {
  return {
    sessionId: player.sessionId,
    nickname: player.nickname,
    characterId: player.heroId,
    transform: {
      x: player.x,
      y: player.y,
      z: player.z,
      rotation: player.rotationY
    },
    combat: {
      health: player.currentHealth,
      maxHealth: player.maxHealth,
      guard: player.currentGuard,
      maxGuard: player.maxGuard,
      isBlocking: player.isBlocking,
      isAttacking: player.isAttacking,
      isGuardBroken: player.isGuardBroken,
      stunUntil: player.stunUntil
    },
    stats: {
      kills: player.kills,
      deaths: player.deaths
    },
    abilities: {
      ultimateCharge: player.ultimateCharge,
      ultimateMax: player.ultimateMax,
      isUsingUltimate: player.isUsingUltimate,
      isUltimateReady: player.isUltimateReady,
      ultimateStartedAt: player.ultimateStartedAt,
      ultimateEndsAt: player.ultimateEndsAt
    },
    locomotion: {
      state: player.locomotionState,
      isCrouching: player.isCrouching,
      isSliding: player.isSliding,
      isWallRunning: player.isWallRunning,
      wallRunSide: player.wallRunSide,
      verticalVelocity: player.verticalVelocity
    }
  };
}

export function clonePlayerState(player: MatchPlayerState): MatchPlayerState {
  return {
    sessionId: player.sessionId,
    userId: player.userId,
    nickname: player.nickname,
    heroId: player.heroId,
    kills: player.kills,
    deaths: player.deaths,
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY,
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
    isSliding: player.isSliding,
    isWallRunning: player.isWallRunning,
    wallRunSide: player.wallRunSide,
    verticalVelocity: player.verticalVelocity,
    sprintBlocked: player.sprintBlocked,
    lastSprintEndedAt: player.lastSprintEndedAt,
    isAttacking: player.isAttacking,
    attackComboIndex: player.attackComboIndex,
    lastAttackAt: player.lastAttackAt,
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

export function cloneMatchState(state: GlobalMatchState): GlobalMatchState {
  return {
    players: Object.values(state.players).reduce<Record<string, MatchPlayerState>>((acc, player) => {
      acc[player.sessionId] = clonePlayerState(player);
      return acc;
    }, {})
  };
}
