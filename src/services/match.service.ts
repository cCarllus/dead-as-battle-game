// Responsável por sincronizar estado autoritativo de jogadores da global_match e expor eventos por sessionId.
import { Client, Room } from "@colyseus/sdk";
import { resolveServerEndpoint } from "../config/server-endpoint";
import { CLIENT_MATCH_EVENTS } from "./match-events";
import { clamp } from "../game/utils/math";
import { cloneMatchPlayerState } from "../models/match-player.utils";
import {
  normalizeAttackStartedPayload,
  normalizeBlockEndedPayload,
  normalizeBlockStartedPayload,
  normalizeCombatBlockPayload,
  normalizeCombatGuardBreakPayload,
  normalizeCombatHitPayload,
  normalizeCombatKillPayload,
  normalizeCombatPlayerDiedPayload,
  normalizeCombatRagdollPayload,
  normalizeCombatStatePayload,
  normalizeCombatUltimatePayload,
  normalizeIdentity,
  normalizeJoinedPayload,
  normalizeLeftPayload,
  normalizeMovedPayload,
  normalizePlayer,
  normalizeRespawnedPayload,
  normalizeSkillCastFinishedPayload,
  normalizeSkillCastStartedPayload,
  normalizeSnapshot
} from "./match-normalization";
import type {
  MatchCombatBlockPayload,
  MatchCombatPlayerDiedPayload,
  MatchCombatRagdollPayload,
  MatchCombatGuardBreakPayload,
  MatchCombatHitPayload,
  MatchCombatKillPayload,
  MatchCombatStatePayload,
  MatchCombatUltimatePayload,
  MatchPlayerLocomotionState,
  MatchPlayerState,
  MatchPlayerWallRunSide,
  MatchSkillCastFinishedEventPayload,
  MatchSkillCastStartedEventPayload
} from "../models/match-player.model";

export const GLOBAL_MATCH_ROOM_NAME = "global_match";

export type MatchIdentity = {
  userId: string;
  nickname: string;
  heroId: string;
  heroLevel: number;
};

export type MatchServiceOptions = {
  endpoint?: string;
  roomName?: string;
  getIdentity: () => MatchIdentity | null;
};

export type MatchService = {
  connect: () => Promise<void>;
  disconnect: () => void;
  getLocalSessionId: () => string | null;
  getPlayers: () => MatchPlayerState[];
  onPlayersChanged: (callback: (players: MatchPlayerState[]) => void) => () => void;
  onPlayerAdded: (callback: (player: MatchPlayerState) => void) => () => void;
  onPlayerUpdated: (callback: (player: MatchPlayerState) => void) => () => void;
  onPlayerRemoved: (callback: (sessionId: string) => void) => () => void;
  onCombatHit: (callback: (payload: MatchCombatHitPayload) => void) => () => void;
  onCombatBlock: (callback: (payload: MatchCombatBlockPayload) => void) => () => void;
  onCombatGuardBreak: (callback: (payload: MatchCombatGuardBreakPayload) => void) => () => void;
  onCombatKill: (callback: (payload: MatchCombatKillPayload) => void) => () => void;
  onCombatUltimate: (callback: (payload: MatchCombatUltimatePayload) => void) => () => void;
  onCombatState: (callback: (payload: MatchCombatStatePayload) => void) => () => void;
  onSkillCastStarted: (callback: (payload: MatchSkillCastStartedEventPayload) => void) => () => void;
  onSkillCastFinished: (callback: (payload: MatchSkillCastFinishedEventPayload) => void) => () => void;
  onPlayerDied: (callback: (payload: MatchCombatPlayerDiedPayload) => void) => () => void;
  onRagdollEnabled: (callback: (payload: MatchCombatRagdollPayload) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
  sendLocalMovement: (movement: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    locomotionState: MatchPlayerLocomotionState;
    isCrouching: boolean;
    isRolling: boolean;
    isWallRunning: boolean;
    wallRunSide: MatchPlayerWallRunSide;
    verticalVelocity: number;
  }) => void;
  sendSprintIntent: (intent: { isShiftPressed: boolean; isForwardPressed: boolean }) => void;
  sendUltimateActivate: () => void;
  sendSkillCast: (slot: 1 | 2 | 3 | 4 | 5) => void;
  sendAttackStart: () => void;
  sendBlockStart: () => void;
  sendBlockEnd: () => void;
  sendRespawnRequest: () => void;
};


export function createMatchService(options: MatchServiceOptions): MatchService {
  const endpoint = options.endpoint ?? resolveServerEndpoint();
  const roomName = options.roomName ?? GLOBAL_MATCH_ROOM_NAME;

  const client = new Client(endpoint);
  let room: Room | null = null;
  let connectPromise: Promise<void> | null = null;
  let suppressNextDisconnectError = false;
  let connectedIdentity: MatchIdentity | null = null;

  const playersBySessionId = new Map<string, MatchPlayerState>();

  const playersChangedListeners = new Set<(players: MatchPlayerState[]) => void>();
  const playerAddedListeners = new Set<(player: MatchPlayerState) => void>();
  const playerUpdatedListeners = new Set<(player: MatchPlayerState) => void>();
  const playerRemovedListeners = new Set<(sessionId: string) => void>();
  const combatHitListeners = new Set<(payload: MatchCombatHitPayload) => void>();
  const combatBlockListeners = new Set<(payload: MatchCombatBlockPayload) => void>();
  const combatGuardBreakListeners = new Set<(payload: MatchCombatGuardBreakPayload) => void>();
  const combatKillListeners = new Set<(payload: MatchCombatKillPayload) => void>();
  const combatUltimateListeners = new Set<(payload: MatchCombatUltimatePayload) => void>();
  const combatStateListeners = new Set<(payload: MatchCombatStatePayload) => void>();
  const skillCastStartedListeners = new Set<(payload: MatchSkillCastStartedEventPayload) => void>();
  const skillCastFinishedListeners = new Set<(payload: MatchSkillCastFinishedEventPayload) => void>();
  const playerDiedListeners = new Set<(payload: MatchCombatPlayerDiedPayload) => void>();
  const ragdollEnabledListeners = new Set<(payload: MatchCombatRagdollPayload) => void>();
  const errorListeners = new Set<(error: Error) => void>();

  const emitPlayersChanged = (): void => {
    const snapshot = Array.from(playersBySessionId.values()).map((player) => cloneMatchPlayerState(player));
    playersChangedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerAdded = (player: MatchPlayerState): void => {
    const snapshot = cloneMatchPlayerState(player);
    playerAddedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerUpdated = (player: MatchPlayerState): void => {
    const snapshot = cloneMatchPlayerState(player);
    playerUpdatedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerRemoved = (sessionId: string): void => {
    playerRemovedListeners.forEach((listener) => {
      listener(sessionId);
    });
  };

  const emitCombatHit = (payload: MatchCombatHitPayload): void => {
    combatHitListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatBlock = (payload: MatchCombatBlockPayload): void => {
    combatBlockListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatGuardBreak = (payload: MatchCombatGuardBreakPayload): void => {
    combatGuardBreakListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatKill = (payload: MatchCombatKillPayload): void => {
    combatKillListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatUltimate = (payload: MatchCombatUltimatePayload): void => {
    combatUltimateListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatState = (payload: MatchCombatStatePayload): void => {
    combatStateListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitSkillCastStarted = (payload: MatchSkillCastStartedEventPayload): void => {
    skillCastStartedListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitSkillCastFinished = (payload: MatchSkillCastFinishedEventPayload): void => {
    skillCastFinishedListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitPlayerDied = (payload: MatchCombatPlayerDiedPayload): void => {
    playerDiedListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitRagdollEnabled = (payload: MatchCombatRagdollPayload): void => {
    ragdollEnabledListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitError = (error: Error): void => {
    errorListeners.forEach((listener) => {
      listener(error);
    });
  };

  const applySnapshot = (players: MatchPlayerState[]): void => {
    const incomingBySessionId = new Map<string, MatchPlayerState>();
    players.forEach((player) => {
      incomingBySessionId.set(player.sessionId, player);
    });

    playersBySessionId.forEach((existingPlayer, sessionId) => {
      if (incomingBySessionId.has(sessionId)) {
        return;
      }

      playersBySessionId.delete(sessionId);
      emitPlayerRemoved(sessionId);
    });

    incomingBySessionId.forEach((incomingPlayer, sessionId) => {
      const existingPlayer = playersBySessionId.get(sessionId);
      if (!existingPlayer) {
        playersBySessionId.set(sessionId, incomingPlayer);
        emitPlayerAdded(incomingPlayer);
        return;
      }

      const changed =
        existingPlayer.x !== incomingPlayer.x ||
        existingPlayer.y !== incomingPlayer.y ||
        existingPlayer.z !== incomingPlayer.z ||
        existingPlayer.rotationY !== incomingPlayer.rotationY ||
        existingPlayer.kills !== incomingPlayer.kills ||
        existingPlayer.deaths !== incomingPlayer.deaths ||
        existingPlayer.nickname !== incomingPlayer.nickname ||
        existingPlayer.heroId !== incomingPlayer.heroId ||
        existingPlayer.maxHealth !== incomingPlayer.maxHealth ||
        existingPlayer.currentHealth !== incomingPlayer.currentHealth ||
        existingPlayer.isAlive !== incomingPlayer.isAlive ||
        existingPlayer.ultimateCharge !== incomingPlayer.ultimateCharge ||
        existingPlayer.ultimateMax !== incomingPlayer.ultimateMax ||
        existingPlayer.isUltimateReady !== incomingPlayer.isUltimateReady ||
        existingPlayer.isUsingUltimate !== incomingPlayer.isUsingUltimate ||
        existingPlayer.ultimateStartedAt !== incomingPlayer.ultimateStartedAt ||
        existingPlayer.ultimateEndsAt !== incomingPlayer.ultimateEndsAt ||
        existingPlayer.maxStamina !== incomingPlayer.maxStamina ||
        existingPlayer.currentStamina !== incomingPlayer.currentStamina ||
        existingPlayer.isSprinting !== incomingPlayer.isSprinting ||
        existingPlayer.sprintBlocked !== incomingPlayer.sprintBlocked ||
        existingPlayer.lastSprintEndedAt !== incomingPlayer.lastSprintEndedAt ||
        existingPlayer.isAttacking !== incomingPlayer.isAttacking ||
        existingPlayer.attackComboIndex !== incomingPlayer.attackComboIndex ||
        existingPlayer.lastAttackAt !== incomingPlayer.lastAttackAt ||
        existingPlayer.combatState !== incomingPlayer.combatState ||
        existingPlayer.combatStateStartedAt !== incomingPlayer.combatStateStartedAt ||
        existingPlayer.combatStateEndsAt !== incomingPlayer.combatStateEndsAt ||
        existingPlayer.attackPhase !== incomingPlayer.attackPhase ||
        existingPlayer.activeActionId !== incomingPlayer.activeActionId ||
        existingPlayer.activeSkillId !== incomingPlayer.activeSkillId ||
        existingPlayer.queuedAttack !== incomingPlayer.queuedAttack ||
        existingPlayer.lastDamagedAt !== incomingPlayer.lastDamagedAt ||
        existingPlayer.deadAt !== incomingPlayer.deadAt ||
        existingPlayer.respawnAvailableAt !== incomingPlayer.respawnAvailableAt ||
        existingPlayer.isBlocking !== incomingPlayer.isBlocking ||
        existingPlayer.blockStartedAt !== incomingPlayer.blockStartedAt ||
        existingPlayer.maxGuard !== incomingPlayer.maxGuard ||
        existingPlayer.currentGuard !== incomingPlayer.currentGuard ||
        existingPlayer.isGuardBroken !== incomingPlayer.isGuardBroken ||
        existingPlayer.stunUntil !== incomingPlayer.stunUntil ||
        existingPlayer.lastGuardDamagedAt !== incomingPlayer.lastGuardDamagedAt ||
        JSON.stringify(existingPlayer.skillCooldowns) !== JSON.stringify(incomingPlayer.skillCooldowns);

      if (changed) {
        playersBySessionId.set(sessionId, incomingPlayer);
        emitPlayerUpdated(incomingPlayer);
      }
    });

    emitPlayersChanged();
  };

  const bindRoomEvents = (connectedRoom: Room): void => {
    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.snapshot, (payload: unknown) => {
      applySnapshot(normalizeSnapshot(payload));
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.playerJoined, (payload: unknown) => {
      const joinedPlayer = normalizeJoinedPayload(payload);
      if (!joinedPlayer) {
        return;
      }

      playersBySessionId.set(joinedPlayer.sessionId, joinedPlayer);
      emitPlayerAdded(joinedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.playerLeft, (payload: unknown) => {
      const sessionId = normalizeLeftPayload(payload);
      if (!sessionId) {
        return;
      }

      const didDelete = playersBySessionId.delete(sessionId);
      if (!didDelete) {
        return;
      }

      emitPlayerRemoved(sessionId);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.playerMoved, (payload: unknown) => {
      const movedPlayer = normalizeMovedPayload(payload);
      if (!movedPlayer) {
        return;
      }

      const existingPlayer = playersBySessionId.get(movedPlayer.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        x: movedPlayer.x,
        y: movedPlayer.y,
        z: movedPlayer.z,
        rotationY: movedPlayer.rotationY,
        locomotionState: movedPlayer.locomotionState,
        isCrouching: movedPlayer.isCrouching,
        isRolling: movedPlayer.isRolling,
        isWallRunning: movedPlayer.isWallRunning,
        wallRunSide: movedPlayer.wallRunSide,
        verticalVelocity: movedPlayer.verticalVelocity
      };

      const didChange =
        existingPlayer.x !== updatedPlayer.x ||
        existingPlayer.y !== updatedPlayer.y ||
        existingPlayer.z !== updatedPlayer.z ||
        existingPlayer.rotationY !== updatedPlayer.rotationY ||
        existingPlayer.locomotionState !== updatedPlayer.locomotionState ||
        existingPlayer.isCrouching !== updatedPlayer.isCrouching ||
        existingPlayer.isRolling !== updatedPlayer.isRolling ||
        existingPlayer.isWallRunning !== updatedPlayer.isWallRunning ||
        existingPlayer.wallRunSide !== updatedPlayer.wallRunSide ||
        existingPlayer.verticalVelocity !== updatedPlayer.verticalVelocity;
      if (!didChange) {
        return;
      }

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.attackStart, (payload: unknown) => {
      const attackStartedPayload = normalizeAttackStartedPayload(payload);
      if (!attackStartedPayload) {
        return;
      }

      const existingPlayer = playersBySessionId.get(attackStartedPayload.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        isAttacking: true,
        attackComboIndex: attackStartedPayload.attackComboIndex,
        lastAttackAt: attackStartedPayload.startedAt,
        combatState: "AttackWindup",
        combatStateStartedAt: attackStartedPayload.startedAt,
        attackPhase: "Windup",
        activeActionId: attackStartedPayload.attackId,
        activeSkillId: "",
        isBlocking: false,
        blockStartedAt: 0
      };

      const didChange =
        existingPlayer.isAttacking !== updatedPlayer.isAttacking ||
        existingPlayer.attackComboIndex !== updatedPlayer.attackComboIndex ||
        existingPlayer.lastAttackAt !== updatedPlayer.lastAttackAt ||
        existingPlayer.combatState !== updatedPlayer.combatState ||
        existingPlayer.combatStateStartedAt !== updatedPlayer.combatStateStartedAt ||
        existingPlayer.attackPhase !== updatedPlayer.attackPhase ||
        existingPlayer.activeActionId !== updatedPlayer.activeActionId ||
        existingPlayer.isBlocking !== updatedPlayer.isBlocking ||
        existingPlayer.blockStartedAt !== updatedPlayer.blockStartedAt;
      if (!didChange) {
        return;
      }

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.blockStart, (payload: unknown) => {
      const blockStartedPayload = normalizeBlockStartedPayload(payload);
      if (!blockStartedPayload) {
        return;
      }

      const existingPlayer = playersBySessionId.get(blockStartedPayload.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        isBlocking: true,
        blockStartedAt: blockStartedPayload.blockStartedAt
      };

      const didChange =
        existingPlayer.isBlocking !== updatedPlayer.isBlocking ||
        existingPlayer.blockStartedAt !== updatedPlayer.blockStartedAt;
      if (!didChange) {
        return;
      }

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.blockEnd, (payload: unknown) => {
      const blockEndedPayload = normalizeBlockEndedPayload(payload);
      if (!blockEndedPayload) {
        return;
      }

      const existingPlayer = playersBySessionId.get(blockEndedPayload.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        isBlocking: false,
        blockStartedAt: 0
      };

      const didChange =
        existingPlayer.isBlocking !== updatedPlayer.isBlocking ||
        existingPlayer.blockStartedAt !== updatedPlayer.blockStartedAt;
      if (!didChange) {
        return;
      }

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.playerRespawn, (payload: unknown) => {
      const respawnedPayload = normalizeRespawnedPayload(payload);
      if (!respawnedPayload) {
        return;
      }

      const existingPlayer = playersBySessionId.get(respawnedPayload.player.sessionId);
      playersBySessionId.set(respawnedPayload.player.sessionId, respawnedPayload.player);

      if (existingPlayer) {
        emitPlayerUpdated(respawnedPayload.player);
      } else {
        emitPlayerAdded(respawnedPayload.player);
      }
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatHit, (payload: unknown) => {
      const hitPayload = normalizeCombatHitPayload(payload);
      if (!hitPayload) {
        return;
      }

      emitCombatHit(hitPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatBlock, (payload: unknown) => {
      const blockPayload = normalizeCombatBlockPayload(payload);
      if (!blockPayload) {
        return;
      }

      emitCombatBlock(blockPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatGuardBreak, (payload: unknown) => {
      const guardBreakPayload = normalizeCombatGuardBreakPayload(payload);
      if (!guardBreakPayload) {
        return;
      }

      emitCombatGuardBreak(guardBreakPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatKill, (payload: unknown) => {
      const killPayload = normalizeCombatKillPayload(payload);
      if (!killPayload) {
        return;
      }

      const killer = playersBySessionId.get(killPayload.killerSessionId);
      if (killer) {
        const updatedKiller = {
          ...killer,
          kills: killPayload.killerKills
        };
        playersBySessionId.set(updatedKiller.sessionId, updatedKiller);
        emitPlayerUpdated(updatedKiller);
      }

      const victim = playersBySessionId.get(killPayload.victimSessionId);
      if (victim) {
        const updatedVictim = {
          ...victim,
          deaths: killPayload.victimDeaths
        };
        playersBySessionId.set(updatedVictim.sessionId, updatedVictim);
        emitPlayerUpdated(updatedVictim);
      }

      emitCombatKill(killPayload);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatUltimate, (payload: unknown) => {
      const ultimatePayload = normalizeCombatUltimatePayload(payload);
      if (!ultimatePayload) {
        return;
      }

      const player = playersBySessionId.get(ultimatePayload.sessionId);
      if (player) {
        const updatedPlayer: MatchPlayerState = {
          ...player,
          isUsingUltimate: true,
          ultimateStartedAt: ultimatePayload.startedAt,
          ultimateEndsAt: ultimatePayload.endsAt
        };

        playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
        emitPlayerUpdated(updatedPlayer);
        emitPlayersChanged();
      }

      emitCombatUltimate(ultimatePayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatSkillCastStarted, (payload: unknown) => {
      const skillPayload = normalizeSkillCastStartedPayload(payload);
      if (!skillPayload) {
        return;
      }

      const player = playersBySessionId.get(skillPayload.sessionId);
      if (player) {
        const updatedPlayer: MatchPlayerState = {
          ...player,
          combatState: "SkillCast",
          combatStateStartedAt: skillPayload.startedAt,
          combatStateEndsAt: skillPayload.endsAt,
          attackPhase: "Windup",
          activeActionId: skillPayload.skillId,
          activeSkillId: skillPayload.skillId,
          skillCooldowns: {
            ...player.skillCooldowns,
            [skillPayload.skillId]: skillPayload.cooldownEndsAt
          }
        };

        playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
        emitPlayerUpdated(updatedPlayer);
        emitPlayersChanged();
      }

      emitSkillCastStarted(skillPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatSkillCastFinished, (payload: unknown) => {
      const finishedPayload = normalizeSkillCastFinishedPayload(payload);
      if (!finishedPayload) {
        return;
      }

      emitSkillCastFinished(finishedPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatPlayerDied, (payload: unknown) => {
      const deathPayload = normalizeCombatPlayerDiedPayload(payload);
      if (!deathPayload) {
        return;
      }

      const player = playersBySessionId.get(deathPayload.sessionId);
      if (player) {
        const updatedPlayer: MatchPlayerState = {
          ...player,
          isAlive: false,
          currentHealth: 0,
          combatState: "Dead",
          deadAt: deathPayload.deadAt,
          respawnAvailableAt: deathPayload.respawnAvailableAt,
          attackPhase: "None",
          activeActionId: "",
          activeSkillId: "",
          isAttacking: false,
          isBlocking: false
        };

        playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
        emitPlayerUpdated(updatedPlayer);
        emitPlayersChanged();
      }

      emitPlayerDied(deathPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatRagdollEnabled, (payload: unknown) => {
      const ragdollPayload = normalizeCombatRagdollPayload(payload);
      if (!ragdollPayload) {
        return;
      }

      emitRagdollEnabled(ragdollPayload);
    });

    connectedRoom.onMessage(CLIENT_MATCH_EVENTS.combatState, (payload: unknown) => {
      const combatStatePayload = normalizeCombatStatePayload(payload);
      if (!combatStatePayload) {
        return;
      }

      const existingPlayer = playersBySessionId.get(combatStatePayload.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        combatState: combatStatePayload.combatState,
        combatStateStartedAt: combatStatePayload.combatStateStartedAt,
        combatStateEndsAt: combatStatePayload.combatStateEndsAt,
        attackPhase: combatStatePayload.attackPhase,
        activeActionId: combatStatePayload.activeActionId,
        activeSkillId: combatStatePayload.activeSkillId,
        isAttacking: combatStatePayload.isAttacking,
        attackComboIndex: combatStatePayload.attackComboIndex,
        lastAttackAt: combatStatePayload.lastAttackAt,
        queuedAttack: combatStatePayload.queuedAttack,
        currentHealth: combatStatePayload.currentHealth,
        maxHealth: combatStatePayload.maxHealth,
        isAlive: combatStatePayload.isAlive,
        lastDamagedAt: combatStatePayload.lastDamagedAt,
        deadAt: combatStatePayload.deadAt,
        respawnAvailableAt: combatStatePayload.respawnAvailableAt,
        skillCooldowns: { ...combatStatePayload.skillCooldowns },
        isBlocking: combatStatePayload.isBlocking,
        blockStartedAt: combatStatePayload.blockStartedAt,
        maxGuard: combatStatePayload.maxGuard,
        currentGuard: clamp(combatStatePayload.currentGuard, 0, combatStatePayload.maxGuard),
        isGuardBroken: combatStatePayload.isGuardBroken,
        stunUntil: combatStatePayload.stunUntil,
        lastGuardDamagedAt: combatStatePayload.lastGuardDamagedAt,
        x: combatStatePayload.x,
        y: combatStatePayload.y,
        z: combatStatePayload.z
      };

      const didChange =
        existingPlayer.combatState !== updatedPlayer.combatState ||
        existingPlayer.combatStateStartedAt !== updatedPlayer.combatStateStartedAt ||
        existingPlayer.combatStateEndsAt !== updatedPlayer.combatStateEndsAt ||
        existingPlayer.attackPhase !== updatedPlayer.attackPhase ||
        existingPlayer.activeActionId !== updatedPlayer.activeActionId ||
        existingPlayer.activeSkillId !== updatedPlayer.activeSkillId ||
        existingPlayer.isAttacking !== updatedPlayer.isAttacking ||
        existingPlayer.attackComboIndex !== updatedPlayer.attackComboIndex ||
        existingPlayer.lastAttackAt !== updatedPlayer.lastAttackAt ||
        existingPlayer.queuedAttack !== updatedPlayer.queuedAttack ||
        existingPlayer.currentHealth !== updatedPlayer.currentHealth ||
        existingPlayer.maxHealth !== updatedPlayer.maxHealth ||
        existingPlayer.isAlive !== updatedPlayer.isAlive ||
        existingPlayer.lastDamagedAt !== updatedPlayer.lastDamagedAt ||
        existingPlayer.deadAt !== updatedPlayer.deadAt ||
        existingPlayer.respawnAvailableAt !== updatedPlayer.respawnAvailableAt ||
        JSON.stringify(existingPlayer.skillCooldowns) !== JSON.stringify(updatedPlayer.skillCooldowns) ||
        existingPlayer.isBlocking !== updatedPlayer.isBlocking ||
        existingPlayer.blockStartedAt !== updatedPlayer.blockStartedAt ||
        existingPlayer.maxGuard !== updatedPlayer.maxGuard ||
        existingPlayer.currentGuard !== updatedPlayer.currentGuard ||
        existingPlayer.isGuardBroken !== updatedPlayer.isGuardBroken ||
        existingPlayer.stunUntil !== updatedPlayer.stunUntil ||
        existingPlayer.lastGuardDamagedAt !== updatedPlayer.lastGuardDamagedAt ||
        existingPlayer.x !== updatedPlayer.x ||
        existingPlayer.y !== updatedPlayer.y ||
        existingPlayer.z !== updatedPlayer.z;
      if (!didChange) {
        return;
      }

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitCombatState(combatStatePayload);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onLeave(() => {
      room = null;
      playersBySessionId.clear();
      emitPlayersChanged();

      if (suppressNextDisconnectError) {
        suppressNextDisconnectError = false;
        return;
      }

      emitError(new Error("Conexão com a partida global foi encerrada."));
    });

    connectedRoom.onError((code, message) => {
      const errorMessage = message ?? `Falha ao conectar na partida global (code: ${String(code)}).`;
      emitError(new Error(errorMessage));
    });
  };

  return {
    connect: async () => {
      if (connectPromise) {
        return connectPromise;
      }

      connectPromise = (async () => {
        const identity = normalizeIdentity(options.getIdentity());
        if (!identity) {
          throw new Error("Perfil local inválido para entrar na partida global.");
        }

        if (
          room &&
          connectedIdentity &&
          connectedIdentity.userId === identity.userId &&
          connectedIdentity.nickname === identity.nickname &&
          connectedIdentity.heroId === identity.heroId &&
          connectedIdentity.heroLevel === identity.heroLevel
        ) {
          return;
        }

        if (room) {
          suppressNextDisconnectError = true;
          room.leave();
          room = null;
          connectedIdentity = null;
          playersBySessionId.clear();
          emitPlayersChanged();
        }

        const connectedRoom = await client.joinOrCreate(roomName, {
          userId: identity.userId,
          nickname: identity.nickname,
          heroId: identity.heroId,
          heroLevel: identity.heroLevel
        });

        room = connectedRoom;
        connectedIdentity = identity;
        bindRoomEvents(connectedRoom);
        connectedRoom.send(CLIENT_MATCH_EVENTS.snapshotRequest);
      })();

      try {
        await connectPromise;
      } catch (error) {
        emitError(error instanceof Error ? error : new Error("Falha inesperada ao conectar na partida."));
        throw error;
      } finally {
        connectPromise = null;
      }
    },
    disconnect: () => {
      if (!room) {
        connectedIdentity = null;
        playersBySessionId.clear();
        emitPlayersChanged();
        return;
      }

      suppressNextDisconnectError = true;
      room.leave();
      room = null;
      connectedIdentity = null;
      playersBySessionId.clear();
      emitPlayersChanged();
    },
    getLocalSessionId: () => {
      return room?.sessionId ?? null;
    },
    getPlayers: () => {
      return Array.from(playersBySessionId.values()).map((player) => cloneMatchPlayerState(player));
    },
    onPlayersChanged: (callback) => {
      playersChangedListeners.add(callback);
      callback(Array.from(playersBySessionId.values()).map((player) => cloneMatchPlayerState(player)));

      return () => {
        playersChangedListeners.delete(callback);
      };
    },
    onPlayerAdded: (callback) => {
      playerAddedListeners.add(callback);
      return () => {
        playerAddedListeners.delete(callback);
      };
    },
    onPlayerUpdated: (callback) => {
      playerUpdatedListeners.add(callback);
      return () => {
        playerUpdatedListeners.delete(callback);
      };
    },
    onPlayerRemoved: (callback) => {
      playerRemovedListeners.add(callback);
      return () => {
        playerRemovedListeners.delete(callback);
      };
    },
    onCombatHit: (callback) => {
      combatHitListeners.add(callback);
      return () => {
        combatHitListeners.delete(callback);
      };
    },
    onCombatBlock: (callback) => {
      combatBlockListeners.add(callback);
      return () => {
        combatBlockListeners.delete(callback);
      };
    },
    onCombatGuardBreak: (callback) => {
      combatGuardBreakListeners.add(callback);
      return () => {
        combatGuardBreakListeners.delete(callback);
      };
    },
    onCombatKill: (callback) => {
      combatKillListeners.add(callback);
      return () => {
        combatKillListeners.delete(callback);
      };
    },
    onCombatUltimate: (callback) => {
      combatUltimateListeners.add(callback);
      return () => {
        combatUltimateListeners.delete(callback);
      };
    },
    onCombatState: (callback) => {
      combatStateListeners.add(callback);
      return () => {
        combatStateListeners.delete(callback);
      };
    },
    onSkillCastStarted: (callback) => {
      skillCastStartedListeners.add(callback);
      return () => {
        skillCastStartedListeners.delete(callback);
      };
    },
    onSkillCastFinished: (callback) => {
      skillCastFinishedListeners.add(callback);
      return () => {
        skillCastFinishedListeners.delete(callback);
      };
    },
    onPlayerDied: (callback) => {
      playerDiedListeners.add(callback);
      return () => {
        playerDiedListeners.delete(callback);
      };
    },
    onRagdollEnabled: (callback) => {
      ragdollEnabledListeners.add(callback);
      return () => {
        ragdollEnabledListeners.delete(callback);
      };
    },
    onError: (callback) => {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    sendLocalMovement: (movement) => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.playerMoveInput, {
        x: movement.x,
        y: movement.y,
        z: movement.z,
        rotationY: movement.rotationY,
        locomotionState: movement.locomotionState,
        isCrouching: movement.isCrouching,
        isRolling: movement.isRolling,
        isWallRunning: movement.isWallRunning,
        wallRunSide: movement.wallRunSide,
        verticalVelocity: movement.verticalVelocity
      });
    },
    sendSprintIntent: (intent) => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.sprintIntent, {
        isShiftPressed: intent.isShiftPressed,
        isForwardPressed: intent.isForwardPressed
      });
    },
    sendUltimateActivate: () => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.ultimateActivate, {});
    },
    sendSkillCast: (slot) => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.skillCast, {
        slot
      });
    },
    sendAttackStart: () => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.attackStart, {});
    },
    sendBlockStart: () => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.blockStart, {});
    },
    sendBlockEnd: () => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.blockEnd, {});
    },
    sendRespawnRequest: () => {
      if (!room) {
        return;
      }

      room.send(CLIENT_MATCH_EVENTS.playerRespawn, {});
    }
  };
}
