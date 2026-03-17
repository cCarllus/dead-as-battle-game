// Handler de rede para intents de combate (ataque e bloqueio).
import type { Room } from "@colyseus/core";
import type {
  MatchAttackStartPayload,
  MatchBlockEndPayload,
  MatchBlockStartPayload,
  MatchSkillCastPayload
} from "../models/match-player.model.js";
import { MATCH_EVENTS } from "./match-events.js";

export type CombatHandler = {
  bind: (room: Room) => void;
};

export function createCombatHandler(options: {
  queueAttackStart: (sessionId: string) => void;
  queueSkillCast: (sessionId: string, slot: 1 | 2 | 3 | 4 | 5) => void;
  queueBlockStart: (sessionId: string) => void;
  queueBlockEnd: (sessionId: string) => void;
}): CombatHandler {
  return {
    bind: (room) => {
      room.onMessage(MATCH_EVENTS.attackStart, (client, _payload: MatchAttackStartPayload) => {
        options.queueAttackStart(client.sessionId);
      });

      room.onMessage(MATCH_EVENTS.blockStart, (client, _payload: MatchBlockStartPayload) => {
        options.queueBlockStart(client.sessionId);
      });

      room.onMessage(MATCH_EVENTS.blockEnd, (client, _payload: MatchBlockEndPayload) => {
        options.queueBlockEnd(client.sessionId);
      });

      room.onMessage(MATCH_EVENTS.skillCast, (client, payload: MatchSkillCastPayload) => {
        const rawSlot = typeof payload?.slot === "number" ? Math.floor(payload.slot) : Number.NaN;
        if (rawSlot < 1 || rawSlot > 5) {
          return;
        }

        options.queueSkillCast(client.sessionId, rawSlot as 1 | 2 | 3 | 4 | 5);
      });
    }
  };
}
