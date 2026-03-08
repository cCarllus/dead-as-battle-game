// Sistema de combate: processa intents de ataque/bloqueio e atualizações contínuas de estado de combate.
import type {
  CombatBlockEventPayload,
  CombatGuardBreakEventPayload,
  CombatHitEventPayload,
  CombatKillEventPayload,
  MatchAttackStartedEventPayload,
  MatchBlockEndedEventPayload,
  MatchBlockStartedEventPayload,
  MatchPlayerState
} from "../models/match-player.model.js";
import { endBlock, startBlock } from "../services/block.service.js";
import { handleAttackStart, tickCombatState } from "../services/combat.service.js";

type PlayerCombatSnapshot = {
  isAttacking: boolean;
  attackComboIndex: number;
  lastAttackAt: number;
  isBlocking: boolean;
  blockStartedAt: number;
  currentGuard: number;
  isGuardBroken: boolean;
  stunUntil: number;
  lastGuardDamagedAt: number;
  x: number;
  y: number;
  z: number;
};

export type CombatSystemResult = {
  didChangeState: boolean;
  combatStateChangedPlayers: MatchPlayerState[];
  attackStartedEvents: MatchAttackStartedEventPayload[];
  blockStartedEvents: MatchBlockStartedEventPayload[];
  blockEndedEvents: MatchBlockEndedEventPayload[];
  hitEvents: CombatHitEventPayload[];
  blockEvents: CombatBlockEventPayload[];
  guardBreakEvents: CombatGuardBreakEventPayload[];
  killEvents: CombatKillEventPayload[];
};

export type CombatSystem = {
  update: (deltaSeconds: number, now: number) => CombatSystemResult;
  queueAttackStart: (sessionId: string) => void;
  queueBlockStart: (sessionId: string) => void;
  queueBlockEnd: (sessionId: string) => void;
  clearPlayer: (sessionId: string) => void;
};

function snapshotCombatState(player: MatchPlayerState): PlayerCombatSnapshot {
  return {
    isAttacking: player.isAttacking,
    attackComboIndex: player.attackComboIndex,
    lastAttackAt: player.lastAttackAt,
    isBlocking: player.isBlocking,
    blockStartedAt: player.blockStartedAt,
    currentGuard: player.currentGuard,
    isGuardBroken: player.isGuardBroken,
    stunUntil: player.stunUntil,
    lastGuardDamagedAt: player.lastGuardDamagedAt,
    x: player.x,
    y: player.y,
    z: player.z
  };
}

function didCombatStateChange(previous: PlayerCombatSnapshot, current: MatchPlayerState): boolean {
  return (
    previous.isAttacking !== current.isAttacking ||
    previous.attackComboIndex !== current.attackComboIndex ||
    previous.lastAttackAt !== current.lastAttackAt ||
    previous.isBlocking !== current.isBlocking ||
    previous.blockStartedAt !== current.blockStartedAt ||
    previous.currentGuard !== current.currentGuard ||
    previous.isGuardBroken !== current.isGuardBroken ||
    previous.stunUntil !== current.stunUntil ||
    previous.lastGuardDamagedAt !== current.lastGuardDamagedAt ||
    previous.x !== current.x ||
    previous.y !== current.y ||
    previous.z !== current.z
  );
}

export function createCombatSystem(options: {
  players: () => Record<string, MatchPlayerState>;
}): CombatSystem {
  const queuedAttackStart = new Set<string>();
  const queuedBlockStart = new Set<string>();
  const queuedBlockEnd = new Set<string>();

  return {
    queueAttackStart: (sessionId) => {
      queuedAttackStart.add(sessionId);
    },
    queueBlockStart: (sessionId) => {
      queuedBlockStart.add(sessionId);
    },
    queueBlockEnd: (sessionId) => {
      queuedBlockEnd.add(sessionId);
    },
    clearPlayer: (sessionId) => {
      queuedAttackStart.delete(sessionId);
      queuedBlockStart.delete(sessionId);
      queuedBlockEnd.delete(sessionId);
    },
    update: (deltaSeconds, now) => {
      const players = options.players();
      const combatSnapshots = new Map<string, PlayerCombatSnapshot>();
      Object.values(players).forEach((player) => {
        combatSnapshots.set(player.sessionId, snapshotCombatState(player));
      });

      let didChangeState = false;
      const combatStateChangedPlayersBySessionId = new Map<string, MatchPlayerState>();
      const attackStartedEvents: MatchAttackStartedEventPayload[] = [];
      const blockStartedEvents: MatchBlockStartedEventPayload[] = [];
      const blockEndedEvents: MatchBlockEndedEventPayload[] = [];
      const hitEvents: CombatHitEventPayload[] = [];
      const blockEvents: CombatBlockEventPayload[] = [];
      const guardBreakEvents: CombatGuardBreakEventPayload[] = [];
      const killEvents: CombatKillEventPayload[] = [];

      Array.from(queuedBlockEnd.values()).forEach((sessionId) => {
        const player = players[sessionId];
        if (!player) {
          return;
        }

        const didEnd = endBlock(player);
        if (!didEnd) {
          return;
        }

        didChangeState = true;
        combatStateChangedPlayersBySessionId.set(player.sessionId, player);
        blockEndedEvents.push({
          sessionId: player.sessionId,
          blockEndedAt: now
        });
      });
      queuedBlockEnd.clear();

      Array.from(queuedBlockStart.values()).forEach((sessionId) => {
        const player = players[sessionId];
        if (!player) {
          return;
        }

        const didStart = startBlock(player, now);
        if (!didStart) {
          return;
        }

        didChangeState = true;
        combatStateChangedPlayersBySessionId.set(player.sessionId, player);
        blockStartedEvents.push({
          sessionId: player.sessionId,
          blockStartedAt: player.blockStartedAt
        });
      });
      queuedBlockStart.clear();

      Array.from(queuedAttackStart.values()).forEach((sessionId) => {
        const attacker = players[sessionId];
        if (!attacker) {
          return;
        }

        const wasBlockingBeforeAttack = attacker.isBlocking;
        const result = handleAttackStart({
          attacker,
          players,
          now
        });

        if (!result.stateChanged) {
          return;
        }

        didChangeState = true;
        combatStateChangedPlayersBySessionId.set(attacker.sessionId, attacker);
        attackStartedEvents.push({
          sessionId: attacker.sessionId,
          attackComboIndex: attacker.attackComboIndex,
          startedAt: attacker.lastAttackAt
        });

        if (wasBlockingBeforeAttack && !attacker.isBlocking) {
          blockEndedEvents.push({
            sessionId: attacker.sessionId,
            blockEndedAt: attacker.lastAttackAt
          });
        }

        if (result.hitEvent) {
          hitEvents.push(result.hitEvent);
          const target = players[result.hitEvent.targetSessionId];
          if (target) {
            combatStateChangedPlayersBySessionId.set(target.sessionId, target);
          }
          if (result.hitEvent.damage > 0) {
            const target = players[result.hitEvent.targetSessionId];
            if (target) {
              console.info(
                `[COMBAT] ${attacker.nickname} hit ${target.nickname} for ${result.hitEvent.damage} damage`
              );
            }
          }
        }

        if (result.blockEvent) {
          blockEvents.push(result.blockEvent);
        }

        if (result.guardBreakEvent) {
          guardBreakEvents.push(result.guardBreakEvent);
        }

        if (result.killEvent) {
          killEvents.push(result.killEvent);
          const victim = players[result.killEvent.victimSessionId];
          if (victim) {
            console.info(`[DEATH] ${victim.nickname} killed by ${attacker.nickname}`);
          }
        }
      });
      queuedAttackStart.clear();

      const didTickCombat = tickCombatState(players, deltaSeconds, now);
      if (didTickCombat) {
        didChangeState = true;
      }

      Object.values(players).forEach((player) => {
        const previous = combatSnapshots.get(player.sessionId);
        if (!previous) {
          return;
        }

        if (!didCombatStateChange(previous, player)) {
          return;
        }

        combatStateChangedPlayersBySessionId.set(player.sessionId, player);
      });

      return {
        didChangeState,
        combatStateChangedPlayers: Array.from(combatStateChangedPlayersBySessionId.values()),
        attackStartedEvents,
        blockStartedEvents,
        blockEndedEvents,
        hitEvents,
        blockEvents,
        guardBreakEvents,
        killEvents
      };
    }
  };
}
