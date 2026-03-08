// Sistema de habilidades: processa intents de ultimate e duração de habilidade ativa.
import type { MatchPlayerState, CombatUltimateEventPayload } from "../models/match-player.model.js";
import { consumeUltimate, syncUltimateReady } from "../services/ultimate.service.js";

const ULTIMATE_ACTIVE_DURATION_MS = 1200;

export type AbilitySystemResult = {
  didChangeState: boolean;
  ultimateEvents: CombatUltimateEventPayload[];
  combatStateChangedPlayers: MatchPlayerState[];
};

export type AbilitySystem = {
  update: (now: number) => AbilitySystemResult;
  queueUltimateActivate: (sessionId: string) => void;
  clearPlayer: (sessionId: string) => void;
};

export function createAbilitySystem(options: {
  players: () => Record<string, MatchPlayerState>;
}): AbilitySystem {
  const queuedUltimateActivate = new Set<string>();

  return {
    queueUltimateActivate: (sessionId) => {
      queuedUltimateActivate.add(sessionId);
    },
    clearPlayer: (sessionId) => {
      queuedUltimateActivate.delete(sessionId);
    },
    update: (now) => {
      const players = options.players();
      const combatStateChangedPlayersBySessionId = new Map<string, MatchPlayerState>();
      const ultimateEvents: CombatUltimateEventPayload[] = [];
      let didChangeState = false;

      Array.from(queuedUltimateActivate.values()).forEach((sessionId) => {
        const player = players[sessionId];
        if (!player || !player.isAlive) {
          return;
        }

        if (now < player.stunUntil || player.isGuardBroken) {
          return;
        }

        syncUltimateReady(player);
        if (!player.isUltimateReady || player.ultimateCharge < player.ultimateMax) {
          return;
        }

        const wasConsumed = consumeUltimate(player);
        if (!wasConsumed) {
          return;
        }

        player.isUsingUltimate = true;
        player.ultimateStartedAt = now;
        player.ultimateEndsAt = now + ULTIMATE_ACTIVE_DURATION_MS;

        didChangeState = true;
        combatStateChangedPlayersBySessionId.set(player.sessionId, player);
        ultimateEvents.push({
          sessionId: player.sessionId,
          characterId: player.heroId,
          durationMs: ULTIMATE_ACTIVE_DURATION_MS,
          startedAt: player.ultimateStartedAt,
          endsAt: player.ultimateEndsAt
        });
      });
      queuedUltimateActivate.clear();

      Object.values(players).forEach((player) => {
        if (!player.isUsingUltimate) {
          return;
        }

        if (now < player.ultimateEndsAt) {
          return;
        }

        player.isUsingUltimate = false;
        didChangeState = true;
        combatStateChangedPlayersBySessionId.set(player.sessionId, player);
      });

      return {
        didChangeState,
        ultimateEvents,
        combatStateChangedPlayers: Array.from(combatStateChangedPlayersBySessionId.values())
      };
    }
  };
}
