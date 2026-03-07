// Responsável por sincronizar estado autoritativo de jogadores da global_match e expor eventos por sessionId.
import { Client, Room } from "@colyseus/sdk";
import { resolveServerEndpoint } from "../config/server-endpoint";
import type {
  MatchPlayerMovedPayload,
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
const MATCH_PLAYER_MOVED_EVENT = "match:player:moved";
const MATCH_PLAYER_MOVE_EVENT = "player_move";
const MATCH_ULTIMATE_ACTIVATE_EVENT = "ultimate:activate";
const DEFAULT_MAX_HEALTH = 1000;
const DEFAULT_ULTIMATE_MAX = 100;

export type MatchIdentity = {
  userId: string;
  nickname: string;
  heroId: string;
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
  onError: (callback: (error: Error) => void) => () => void;
  sendLocalMovement: (movement: { x: number; y: number; z: number; rotationY: number }) => void;
  sendUltimateActivate: () => void;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

function normalizeIdentity(identity: MatchIdentity | null): MatchIdentity | null {
  if (!identity) {
    return null;
  }

  const userId = normalizeText(identity.userId);
  const nickname = normalizeText(identity.nickname);
  const heroId = normalizeText(identity.heroId);

  if (!userId || !nickname || !heroId) {
    return null;
  }

  return {
    userId,
    nickname,
    heroId
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
  const heroId = normalizeText(candidate.heroId);
  const x = normalizeNumber(candidate.x);
  const y = normalizeNumber(candidate.y);
  const z = normalizeNumber(candidate.z);
  const rotationY = normalizeNumber(candidate.rotationY);
  const maxHealth = normalizeNumber(candidate.maxHealth) ?? DEFAULT_MAX_HEALTH;
  const currentHealth = normalizeNumber(candidate.currentHealth) ?? maxHealth;
  const isAlive = normalizeBoolean(candidate.isAlive) ?? currentHealth > 0;
  const ultimateMax = normalizeNumber(candidate.ultimateMax) ?? DEFAULT_ULTIMATE_MAX;
  const ultimateCharge = normalizeNumber(candidate.ultimateCharge) ?? 0;
  const isUltimateReady = normalizeBoolean(candidate.isUltimateReady) ?? ultimateCharge >= ultimateMax;
  const joinedAt = typeof candidate.joinedAt === "number" ? candidate.joinedAt : Date.now();

  if (!sessionId || !userId || !nickname || !heroId || x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  const safeCurrentHealth = Math.max(0, Math.min(Math.floor(currentHealth), safeMaxHealth));
  const safeUltimateMax = Math.max(1, Math.floor(ultimateMax));
  const safeUltimateCharge = Math.max(0, Math.min(Math.floor(ultimateCharge), safeUltimateMax));

  return {
    sessionId,
    userId,
    nickname,
    heroId,
    x,
    y,
    z,
    rotationY,
    maxHealth: safeMaxHealth,
    currentHealth: safeCurrentHealth,
    isAlive: safeCurrentHealth > 0 ? isAlive : false,
    ultimateCharge: safeUltimateCharge,
    ultimateMax: safeUltimateMax,
    isUltimateReady: safeUltimateCharge >= safeUltimateMax ? true : isUltimateReady,
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

function normalizeMovedPayload(payload: unknown): MatchPlayerMovedPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerMovedPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const x = normalizeNumber(candidate.x);
  const y = normalizeNumber(candidate.y);
  const z = normalizeNumber(candidate.z);
  const rotationY = normalizeNumber(candidate.rotationY);

  if (!sessionId || x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  return { sessionId, x, y, z, rotationY };
}

function clonePlayer(player: MatchPlayerState): MatchPlayerState {
  return {
    sessionId: player.sessionId,
    userId: player.userId,
    nickname: player.nickname,
    heroId: player.heroId,
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY,
    maxHealth: player.maxHealth,
    currentHealth: player.currentHealth,
    isAlive: player.isAlive,
    ultimateCharge: player.ultimateCharge,
    ultimateMax: player.ultimateMax,
    isUltimateReady: player.isUltimateReady,
    joinedAt: player.joinedAt
  };
}

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
  const errorListeners = new Set<(error: Error) => void>();

  const emitPlayersChanged = (): void => {
    const snapshot = Array.from(playersBySessionId.values()).map((player) => clonePlayer(player));
    playersChangedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerAdded = (player: MatchPlayerState): void => {
    const snapshot = clonePlayer(player);
    playerAddedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerUpdated = (player: MatchPlayerState): void => {
    const snapshot = clonePlayer(player);
    playerUpdatedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerRemoved = (sessionId: string): void => {
    playerRemovedListeners.forEach((listener) => {
      listener(sessionId);
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
        existingPlayer.nickname !== incomingPlayer.nickname ||
        existingPlayer.heroId !== incomingPlayer.heroId ||
        existingPlayer.maxHealth !== incomingPlayer.maxHealth ||
        existingPlayer.currentHealth !== incomingPlayer.currentHealth ||
        existingPlayer.isAlive !== incomingPlayer.isAlive ||
        existingPlayer.ultimateCharge !== incomingPlayer.ultimateCharge ||
        existingPlayer.ultimateMax !== incomingPlayer.ultimateMax ||
        existingPlayer.isUltimateReady !== incomingPlayer.isUltimateReady;

      if (changed) {
        playersBySessionId.set(sessionId, incomingPlayer);
        emitPlayerUpdated(incomingPlayer);
      }
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
      emitPlayerAdded(joinedPlayer);
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

      emitPlayerRemoved(sessionId);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(MATCH_PLAYER_MOVED_EVENT, (payload: unknown) => {
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
        rotationY: movedPlayer.rotationY
      };

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
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
          connectedIdentity.heroId === identity.heroId
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
          heroId: identity.heroId
        });

        room = connectedRoom;
        connectedIdentity = identity;
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
      return Array.from(playersBySessionId.values()).map((player) => clonePlayer(player));
    },
    onPlayersChanged: (callback) => {
      playersChangedListeners.add(callback);
      callback(Array.from(playersBySessionId.values()).map((player) => clonePlayer(player)));

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

      room.send(MATCH_PLAYER_MOVE_EVENT, {
        x: movement.x,
        y: movement.y,
        z: movement.z,
        rotationY: movement.rotationY
      });
    },
    sendUltimateActivate: () => {
      if (!room) {
        return;
      }

      room.send(MATCH_ULTIMATE_ACTIVATE_EVENT, {});
    }
  };
}
