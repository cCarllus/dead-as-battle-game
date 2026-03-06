// Responsável por conectar no room global_match e propagar eventos de presença de jogadores para a UI/cena.
import { Client, Room } from "@colyseus/sdk";
import { resolveServerEndpoint } from "../config/server-endpoint";
import type {
  MatchPlayerJoinedPayload,
  MatchPlayerLeftPayload,
  MatchPlayerState,
  MatchSnapshotPayload
} from "../models/match-player.model";

export const GLOBAL_MATCH_ROOM_NAME = "global_match";
const MATCH_SNAPSHOT_REQUEST_EVENT = "match:snapshot:request";
const MATCH_SNAPSHOT_EVENT = "match:snapshot";
const MATCH_PLAYER_JOINED_EVENT = "match:player:joined";
const MATCH_PLAYER_LEFT_EVENT = "match:player:left";

export type MatchIdentity = {
  userId: string;
  nickname: string;
  selectedHeroId: string;
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
  onPlayerJoined: (callback: (player: MatchPlayerState) => void) => () => void;
  onPlayerLeft: (callback: (sessionId: string) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIdentity(identity: MatchIdentity | null): MatchIdentity | null {
  if (!identity) {
    return null;
  }

  const userId = normalizeText(identity.userId);
  const nickname = normalizeText(identity.nickname);
  const selectedHeroId = normalizeText(identity.selectedHeroId);

  if (!userId || !nickname || !selectedHeroId) {
    return null;
  }

  return {
    userId,
    nickname,
    selectedHeroId
  };
}

function normalizePosition(value: unknown): MatchPlayerState["position"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MatchPlayerState["position"]>;
  if (
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    typeof candidate.z !== "number"
  ) {
    return null;
  }

  return {
    x: candidate.x,
    y: candidate.y,
    z: candidate.z
  };
}

function normalizePlayer(value: unknown): MatchPlayerState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MatchPlayerState>;
  const sessionId = normalizeText(candidate.sessionId);
  const userId = normalizeText(candidate.userId);
  const nickname = normalizeText(candidate.nickname);
  const selectedHeroId = normalizeText(candidate.selectedHeroId);
  const position = normalizePosition(candidate.position);
  const joinedAt = typeof candidate.joinedAt === "number" ? candidate.joinedAt : Date.now();

  if (!sessionId || !userId || !nickname || !selectedHeroId || !position) {
    return null;
  }

  return {
    sessionId,
    userId,
    nickname,
    selectedHeroId,
    position,
    joinedAt
  };
}

function normalizeSnapshot(payload: unknown): MatchPlayerState[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as Partial<MatchSnapshotPayload>;
  if (!candidate.players || typeof candidate.players !== "object") {
    return [];
  }

  return Object.values(candidate.players)
    .map((player) => normalizePlayer(player))
    .filter((player): player is MatchPlayerState => player !== null);
}

function normalizeJoinedPayload(payload: unknown): MatchPlayerState | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerJoinedPayload>;
  return normalizePlayer(candidate.player);
}

function normalizeLeftPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerLeftPayload>;
  return normalizeText(candidate.sessionId);
}

function clonePlayer(player: MatchPlayerState): MatchPlayerState {
  return {
    ...player,
    position: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    }
  };
}

export function createMatchService(options: MatchServiceOptions): MatchService {
  const endpoint = options.endpoint ?? resolveServerEndpoint();
  const roomName = options.roomName ?? GLOBAL_MATCH_ROOM_NAME;

  const client = new Client(endpoint);
  let room: Room | null = null;
  let connectPromise: Promise<void> | null = null;
  let suppressNextDisconnectError = false;

  const playersBySessionId = new Map<string, MatchPlayerState>();

  const playersChangedListeners = new Set<(players: MatchPlayerState[]) => void>();
  const playerJoinedListeners = new Set<(player: MatchPlayerState) => void>();
  const playerLeftListeners = new Set<(sessionId: string) => void>();
  const errorListeners = new Set<(error: Error) => void>();

  const emitPlayersChanged = (): void => {
    const snapshot = Array.from(playersBySessionId.values()).map((player) => clonePlayer(player));
    playersChangedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerJoined = (player: MatchPlayerState): void => {
    const clonedPlayer = clonePlayer(player);
    playerJoinedListeners.forEach((listener) => {
      listener(clonedPlayer);
    });
  };

  const emitPlayerLeft = (sessionId: string): void => {
    playerLeftListeners.forEach((listener) => {
      listener(sessionId);
    });
  };

  const emitError = (error: Error): void => {
    errorListeners.forEach((listener) => {
      listener(error);
    });
  };

  const applySnapshot = (players: MatchPlayerState[]): void => {
    playersBySessionId.clear();

    players.forEach((player) => {
      playersBySessionId.set(player.sessionId, player);
    });

    emitPlayersChanged();
  };

  const bindRoomEvents = (connectedRoom: Room): void => {
    connectedRoom.onMessage(MATCH_SNAPSHOT_EVENT, (payload: unknown) => {
      applySnapshot(normalizeSnapshot(payload));
    });

    connectedRoom.onMessage(MATCH_PLAYER_JOINED_EVENT, (payload: unknown) => {
      const joinedPlayer = normalizeJoinedPayload(payload);
      if (!joinedPlayer) {
        return;
      }

      playersBySessionId.set(joinedPlayer.sessionId, joinedPlayer);
      emitPlayerJoined(joinedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(MATCH_PLAYER_LEFT_EVENT, (payload: unknown) => {
      const sessionId = normalizeLeftPayload(payload);
      if (!sessionId) {
        return;
      }

      const didDelete = playersBySessionId.delete(sessionId);
      if (!didDelete) {
        return;
      }

      emitPlayerLeft(sessionId);
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
      if (room) {
        return;
      }

      if (connectPromise) {
        return connectPromise;
      }

      connectPromise = (async () => {
        const identity = normalizeIdentity(options.getIdentity());
        if (!identity) {
          throw new Error("Perfil local inválido para entrar na partida global.");
        }

        const connectedRoom = await client.joinOrCreate(roomName, {
          userId: identity.userId,
          nickname: identity.nickname,
          selectedHeroId: identity.selectedHeroId
        });

        room = connectedRoom;
        bindRoomEvents(connectedRoom);
        connectedRoom.send(MATCH_SNAPSHOT_REQUEST_EVENT);
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
        playersBySessionId.clear();
        emitPlayersChanged();
        return;
      }

      suppressNextDisconnectError = true;
      room.leave();
      room = null;
      playersBySessionId.clear();
      emitPlayersChanged();
    },
    getLocalSessionId: () => {
      return room?.sessionId ?? null;
    },
    getPlayers: () => {
      return Array.from(playersBySessionId.values()).map((player) => clonePlayer(player));
    },
    onPlayersChanged: (callback) => {
      playersChangedListeners.add(callback);
      callback(Array.from(playersBySessionId.values()).map((player) => clonePlayer(player)));

      return () => {
        playersChangedListeners.delete(callback);
      };
    },
    onPlayerJoined: (callback) => {
      playerJoinedListeners.add(callback);
      return () => {
        playerJoinedListeners.delete(callback);
      };
    },
    onPlayerLeft: (callback) => {
      playerLeftListeners.add(callback);
      return () => {
        playerLeftListeners.delete(callback);
      };
    },
    onError: (callback) => {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    }
  };
}
