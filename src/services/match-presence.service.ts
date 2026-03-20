// Responsável por observar presença do room global_match via LobbyRoom para exibir jogadores conectados na Home.
import { Client, Room } from "@colyseus/sdk";
import { resolveServerEndpoint } from "@/config/server-endpoint";

const LOBBY_ROOM_NAME = "lobby";
const LOBBY_ROOMS_EVENT = "rooms";
const LOBBY_ROOM_ADDED_EVENT = "+";
const LOBBY_ROOM_REMOVED_EVENT = "-";
const LOBBY_FILTER_REFRESH_INTERVAL_MS = 2500;

export type MatchLobbyPresenceSnapshot = {
  onlineCount: number;
  playerNicknames: string[];
};

export type MatchPresenceServiceOptions = {
  endpoint?: string;
  roomName?: string;
};

export type MatchPresenceService = {
  connect: () => Promise<void>;
  disconnect: () => void;
  getSnapshot: () => MatchLobbyPresenceSnapshot;
  onSnapshotChange: (listener: (snapshot: MatchLobbyPresenceSnapshot) => void) => () => void;
  onError: (listener: (error: Error) => void) => () => void;
};

type LobbyRoomMetadata = {
  onlinePlayers?: unknown;
  playerNicknames?: unknown;
};

type LobbyRoomEntry = {
  roomId: string;
  name: string;
  clients: number;
  metadata?: LobbyRoomMetadata;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePlayerNicknames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => entry !== null)
    .slice(0, 64);
}

function normalizeLobbyRoomEntry(payload: unknown): LobbyRoomEntry | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<LobbyRoomEntry>;
  const roomId = normalizeText(candidate.roomId);
  const name = normalizeText(candidate.name);

  if (!roomId || !name) {
    return null;
  }

  const clients = typeof candidate.clients === "number" && Number.isFinite(candidate.clients)
    ? Math.max(0, Math.floor(candidate.clients))
    : 0;

  const metadata = candidate.metadata && typeof candidate.metadata === "object"
    ? (candidate.metadata as LobbyRoomMetadata)
    : undefined;

  return {
    roomId,
    name,
    clients,
    metadata
  };
}

function normalizeLobbyRoomAddedPayload(payload: unknown): LobbyRoomEntry | null {
  if (Array.isArray(payload) && payload.length >= 2) {
    return normalizeLobbyRoomEntry(payload[1]);
  }

  return normalizeLobbyRoomEntry(payload);
}

function normalizeLobbyRoomRemovedPayload(payload: unknown): string | null {
  if (Array.isArray(payload) && payload.length > 0) {
    return normalizeText(payload[0]);
  }

  return normalizeText(payload);
}

function cloneSnapshot(snapshot: MatchLobbyPresenceSnapshot): MatchLobbyPresenceSnapshot {
  return {
    onlineCount: snapshot.onlineCount,
    playerNicknames: [...snapshot.playerNicknames]
  };
}

export function createMatchPresenceService(options: MatchPresenceServiceOptions = {}): MatchPresenceService {
  const endpoint = options.endpoint ?? resolveServerEndpoint();
  const roomName = options.roomName ?? "global_match";

  const client = new Client(endpoint);
  let room: Room | null = null;
  let connectPromise: Promise<void> | null = null;
  let suppressNextDisconnectError = false;
  let filterRefreshIntervalId: number | null = null;

  const roomEntries = new Map<string, LobbyRoomEntry>();

  const listeners = new Set<(snapshot: MatchLobbyPresenceSnapshot) => void>();
  const errorListeners = new Set<(error: Error) => void>();

  let snapshot: MatchLobbyPresenceSnapshot = {
    onlineCount: 0,
    playerNicknames: []
  };

  const emitError = (error: Error): void => {
    errorListeners.forEach((listener) => {
      listener(error);
    });
  };

  const clearFilterRefreshInterval = (): void => {
    if (filterRefreshIntervalId === null) {
      return;
    }

    window.clearInterval(filterRefreshIntervalId);
    filterRefreshIntervalId = null;
  };

  const requestLobbyFilterRefresh = (): void => {
    if (!room) {
      return;
    }

    room.send("filter", {
      name: roomName
    });
  };

  const emitSnapshot = (): void => {
    const clonedSnapshot = cloneSnapshot(snapshot);
    listeners.forEach((listener) => {
      listener(clonedSnapshot);
    });
  };

  const recomputeSnapshot = (): void => {
    const targetRoom = Array.from(roomEntries.values())
      .filter((entry) => entry.name === roomName)
      .sort((left, right) => left.roomId.localeCompare(right.roomId))[0];

    if (!targetRoom) {
      snapshot = {
        onlineCount: 0,
        playerNicknames: []
      };
      emitSnapshot();
      return;
    }

    const metadataOnlinePlayers =
      typeof targetRoom.metadata?.onlinePlayers === "number" && Number.isFinite(targetRoom.metadata.onlinePlayers)
        ? Math.max(0, Math.floor(targetRoom.metadata.onlinePlayers))
        : null;

    const playerNicknames = normalizePlayerNicknames(targetRoom.metadata?.playerNicknames);

    snapshot = {
      onlineCount: metadataOnlinePlayers ?? Math.max(targetRoom.clients, playerNicknames.length),
      playerNicknames
    };

    emitSnapshot();
  };

  const bindRoomEvents = (connectedRoom: Room): void => {
    connectedRoom.onMessage(LOBBY_ROOMS_EVENT, (payload: unknown) => {
      roomEntries.clear();

      if (!Array.isArray(payload)) {
        recomputeSnapshot();
        return;
      }

      payload.forEach((entryPayload) => {
        const entry = normalizeLobbyRoomEntry(entryPayload);
        if (!entry || entry.name !== roomName) {
          return;
        }

        roomEntries.set(entry.roomId, entry);
      });

      recomputeSnapshot();
    });

    connectedRoom.onMessage(LOBBY_ROOM_ADDED_EVENT, (payload: unknown) => {
      const entry = normalizeLobbyRoomAddedPayload(payload);
      if (!entry || entry.name !== roomName) {
        return;
      }

      roomEntries.set(entry.roomId, entry);
      recomputeSnapshot();
    });

    connectedRoom.onMessage(LOBBY_ROOM_REMOVED_EVENT, (payload: unknown) => {
      const roomId = normalizeLobbyRoomRemovedPayload(payload);
      if (!roomId) {
        return;
      }

      roomEntries.delete(roomId);
      recomputeSnapshot();
    });

    connectedRoom.onLeave(() => {
      room = null;
      clearFilterRefreshInterval();
      roomEntries.clear();
      recomputeSnapshot();

      if (suppressNextDisconnectError) {
        suppressNextDisconnectError = false;
        return;
      }

      emitError(new Error("Conexão com o LobbyRoom foi encerrada."));
    });

    connectedRoom.onError((code, message) => {
      emitError(new Error(message ?? `Erro no LobbyRoom (code: ${String(code)}).`));
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
        const connectedRoom = await client.joinOrCreate(LOBBY_ROOM_NAME);
        room = connectedRoom;
        bindRoomEvents(connectedRoom);
        requestLobbyFilterRefresh();

        filterRefreshIntervalId = window.setInterval(() => {
          requestLobbyFilterRefresh();
        }, LOBBY_FILTER_REFRESH_INTERVAL_MS);
      })();

      try {
        await connectPromise;
      } catch (error) {
        emitError(error instanceof Error ? error : new Error("Falha ao conectar no LobbyRoom."));
        throw error;
      } finally {
        connectPromise = null;
      }
    },
    disconnect: () => {
      if (!room) {
        clearFilterRefreshInterval();
        roomEntries.clear();
        recomputeSnapshot();
        return;
      }

      suppressNextDisconnectError = true;
      room.leave();
      room = null;
      clearFilterRefreshInterval();
      roomEntries.clear();
      recomputeSnapshot();
    },
    getSnapshot: () => cloneSnapshot(snapshot),
    onSnapshotChange: (listener) => {
      listeners.add(listener);
      listener(cloneSnapshot(snapshot));

      return () => {
        listeners.delete(listener);
      };
    },
    onError: (listener) => {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    }
  };
}
