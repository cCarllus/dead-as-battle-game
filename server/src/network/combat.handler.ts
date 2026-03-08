// Handler de rede para intents de combate (ataque e bloqueio).
import type { Room } from "@colyseus/core";
import type {
  MatchAttackStartPayload,
  MatchBlockEndPayload,
  MatchBlockStartPayload
} from "../models/match-player.model.js";
import { MATCH_EVENTS } from "./match-events.js";

export type CombatHandler = {
  bind: (room: Room) => void;
};

export function createCombatHandler(options: {
  queueAttackStart: (sessionId: string) => void;
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
    }
  };
}
