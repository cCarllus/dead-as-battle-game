// Handler de rede para intents de habilidades (ultimate).
import type { Room } from "@colyseus/core";
import type { MatchUltimateActivatePayload } from "../models/match-player.model.js";
import { MATCH_EVENTS } from "./match-events.js";

export type AbilityHandler = {
  bind: (room: Room) => void;
};

export function createAbilityHandler(options: {
  queueUltimateActivate: (sessionId: string) => void;
}): AbilityHandler {
  return {
    bind: (room) => {
      room.onMessage(MATCH_EVENTS.ultimateActivate, (client, _payload: MatchUltimateActivatePayload) => {
        options.queueUltimateActivate(client.sessionId);
      });
    }
  };
}
