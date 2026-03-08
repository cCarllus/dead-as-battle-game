// Handler de rede para inputs de movimentação e respawn.
import type { Client, Room } from "@colyseus/core";
import type {
  MatchMovePayload,
  MatchRespawnRequestPayload,
  MatchSprintIntentPayload
} from "../models/match-player.model.js";
import { normalizeMoveIntent, normalizeSprintIntent, type NormalizedMoveIntent } from "../services/movement.service.js";
import type { SprintInputState } from "../services/stamina.service.js";
import { MATCH_EVENTS } from "./match-events.js";

export type PlayerInputHandler = {
  bind: (room: Room) => void;
};

export function createPlayerInputHandler(options: {
  moveIntentBySessionId: Map<string, NormalizedMoveIntent>;
  sprintInputBySessionId: Map<string, SprintInputState>;
  queuedRespawnRequests: Set<string>;
  onSnapshotRequest: (client: Client) => void;
}): PlayerInputHandler {
  return {
    bind: (room) => {
      room.onMessage(MATCH_EVENTS.snapshotRequest, (client) => {
        options.onSnapshotRequest(client);
      });

      room.onMessage(MATCH_EVENTS.playerMoveInput, (client, payload: MatchMovePayload) => {
        const normalized = normalizeMoveIntent(payload);
        if (!normalized) {
          return;
        }

        options.moveIntentBySessionId.set(client.sessionId, normalized);
      });

      room.onMessage(MATCH_EVENTS.sprintIntent, (client, payload: MatchSprintIntentPayload) => {
        const normalized = normalizeSprintIntent(payload);
        if (!normalized) {
          return;
        }

        options.sprintInputBySessionId.set(client.sessionId, normalized);
      });

      room.onMessage(MATCH_EVENTS.playerRespawn, (client, _payload: MatchRespawnRequestPayload) => {
        options.queuedRespawnRequests.add(client.sessionId);
      });
    }
  };
}
