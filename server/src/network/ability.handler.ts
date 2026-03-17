// Handler de rede para intents legadas de habilidade (ultimate).
import type { Room } from "@colyseus/core";
import type { MatchUltimateActivatePayload } from "../models/match-player.model.js";
import { MATCH_EVENTS } from "./match-events.js";

export type AbilityHandler = {
  bind: (room: Room) => void;
};

export function createAbilityHandler(options: {
  queueSkillCast: (sessionId: string, slot: 1 | 2 | 3 | 4 | 5) => void;
}): AbilityHandler {
  return {
    bind: (room) => {
      room.onMessage(MATCH_EVENTS.ultimateActivate, (client, _payload: MatchUltimateActivatePayload) => {
        options.queueSkillCast(client.sessionId, 5);
      });
    }
  };
}
