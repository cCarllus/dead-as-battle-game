import { Client, Room } from "@colyseus/sdk";
import { resolveServerEndpoint } from "../config/server-endpoint";
import type { ChatMessage } from "../models/chat-message.model";

export const GLOBAL_CHAT_ROOM_NAME = "global_chat";
export const CHAT_MAX_MESSAGE_LENGTH = 200;
const CHAT_HISTORY_LIMIT = 100;

export type ChatIdentity = {
  userId: string;
  nickname: string;
  championName: string;
  championLevel: number;
};

export type ChatError = {
  code: string;
  message: string;
  timestamp: number;
};

export type ChatPresence = {
  onlineUsers: number;
  connectedSessions: number;
  timestamp: number;
};

export type ChatServiceOptions = {
  endpoint?: string;
  roomName?: string;
  getIdentity: () => ChatIdentity | null;
};

export type ChatService = {
  connect: () => Promise<void>;
  sendMessage: (text: string) => void;
  onHistory: (callback: (history: readonly ChatMessage[]) => void) => () => void;
  onMessage: (callback: (message: ChatMessage) => void) => () => void;
  onError: (callback: (error: ChatError) => void) => () => void;
  onPresence: (callback: (presence: ChatPresence) => void) => () => void;
  disconnect: () => void;
};

function normalizeIncomingMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as Partial<ChatMessage>;

  if (
    typeof message.id !== "string" ||
    typeof message.userId !== "string" ||
    typeof message.nickname !== "string" ||
    typeof message.text !== "string" ||
    typeof message.timestamp !== "number"
  ) {
    return null;
  }

  return {
    id: message.id,
    userId: message.userId,
    nickname: message.nickname,
    championName: typeof message.championName === "string" && message.championName.trim()
      ? message.championName
      : "Unknown",
    championLevel: typeof message.championLevel === "number" && Number.isFinite(message.championLevel)
      ? Math.max(1, Math.floor(message.championLevel))
      : 1,
    text: message.text,
    timestamp: message.timestamp
  };
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeIncomingMessage(entry))
    .filter((entry): entry is ChatMessage => entry !== null);
}

function normalizeError(value: unknown): ChatError {
  if (!value || typeof value !== "object") {
    return {
      code: "UNKNOWN",
      message: "Unexpected chat error.",
      timestamp: Date.now()
    };
  }

  const error = value as Partial<ChatError>;

  return {
    code: typeof error.code === "string" ? error.code : "UNKNOWN",
    message: typeof error.message === "string" ? error.message : "Unexpected chat error.",
    timestamp: typeof error.timestamp === "number" ? error.timestamp : Date.now()
  };
}

function normalizePresence(value: unknown): ChatPresence {
  if (!value || typeof value !== "object") {
    return {
      onlineUsers: 0,
      connectedSessions: 0,
      timestamp: Date.now()
    };
  }

  const presence = value as Partial<ChatPresence>;

  return {
    onlineUsers:
      typeof presence.onlineUsers === "number" && Number.isFinite(presence.onlineUsers)
        ? Math.max(0, Math.floor(presence.onlineUsers))
        : 0,
    connectedSessions:
      typeof presence.connectedSessions === "number" && Number.isFinite(presence.connectedSessions)
        ? Math.max(0, Math.floor(presence.connectedSessions))
        : 0,
    timestamp: typeof presence.timestamp === "number" ? presence.timestamp : Date.now()
  };
}

function normalizeIdentity(rawIdentity: ChatIdentity | null): ChatIdentity | null {
  if (!rawIdentity) {
    return null;
  }

  const userId = rawIdentity.userId.trim();
  const nickname = rawIdentity.nickname.trim();
  const championName = rawIdentity.championName.trim();
  const championLevel = Math.max(1, Math.floor(rawIdentity.championLevel));

  if (!userId || !nickname || !championName) {
    return null;
  }

  return { userId, nickname, championName, championLevel };
}

export function createChatService(options: ChatServiceOptions): ChatService {
  const endpoint = options.endpoint ?? resolveServerEndpoint();
  const roomName = options.roomName ?? GLOBAL_CHAT_ROOM_NAME;

  const client = new Client(endpoint);
  let room: Room | null = null;
  let connectPromise: Promise<void> | null = null;

  const historyListeners = new Set<(history: readonly ChatMessage[]) => void>();
  const messageListeners = new Set<(message: ChatMessage) => void>();
  const errorListeners = new Set<(error: ChatError) => void>();
  const presenceListeners = new Set<(presence: ChatPresence) => void>();
  let latestHistory: ChatMessage[] = [];
  let latestPresence: ChatPresence = {
    onlineUsers: 0,
    connectedSessions: 0,
    timestamp: Date.now()
  };
  let suppressNextDisconnectError = false;

  const emitHistory = (history: readonly ChatMessage[]): void => {
    latestHistory = [...history].slice(-CHAT_HISTORY_LIMIT);
    historyListeners.forEach((listener) => {
      listener(latestHistory);
    });
  };

  const emitMessage = (message: ChatMessage): void => {
    latestHistory = [...latestHistory, message].slice(-CHAT_HISTORY_LIMIT);
    messageListeners.forEach((listener) => {
      listener(message);
    });
  };

  const emitError = (error: ChatError): void => {
    errorListeners.forEach((listener) => {
      listener(error);
    });
  };

  const emitPresence = (presence: ChatPresence): void => {
    latestPresence = presence;
    presenceListeners.forEach((listener) => {
      listener(presence);
    });
  };

  const bindRoomEvents = (connectedRoom: Room): void => {
    connectedRoom.onMessage("chat:history", (payload: unknown) => {
      emitHistory(normalizeHistory(payload));
    });

    connectedRoom.onMessage("chat:message", (payload: unknown) => {
      const message = normalizeIncomingMessage(payload);
      if (!message) {
        return;
      }

      emitMessage(message);
    });

    connectedRoom.onMessage("chat:error", (payload: unknown) => {
      emitError(normalizeError(payload));
    });

    connectedRoom.onMessage("chat:presence", (payload: unknown) => {
      emitPresence(normalizePresence(payload));
    });

    connectedRoom.onLeave(() => {
      room = null;
      if (suppressNextDisconnectError) {
        suppressNextDisconnectError = false;
        return;
      }

      emitError({
        code: "DISCONNECTED",
        message: "Disconnected from global chat.",
        timestamp: Date.now()
      });
    });

    connectedRoom.onError((code, message) => {
      emitError({
        code: String(code),
        message: message ?? "Unable to connect to global chat.",
        timestamp: Date.now()
      });
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
          const error: ChatError = {
            code: "NO_IDENTITY",
            message: "Missing local profile to connect to chat.",
            timestamp: Date.now()
          };
          emitError(error);
          throw new Error(error.message);
        }

        const connectedRoom = await client.joinOrCreate(roomName, {
          userId: identity.userId,
          nickname: identity.nickname,
          championName: identity.championName,
          championLevel: identity.championLevel
        });

        room = connectedRoom;
        bindRoomEvents(connectedRoom);
      })();

      try {
        await connectPromise;
      } finally {
        connectPromise = null;
      }
    },
    sendMessage: (text) => {
      const connectedRoom = room;
      if (!connectedRoom) {
        emitError({
          code: "NOT_CONNECTED",
          message: "Chat is not connected yet.",
          timestamp: Date.now()
        });
        return;
      }

      const identity = normalizeIdentity(options.getIdentity());
      if (!identity) {
        emitError({
          code: "NO_IDENTITY",
          message: "Missing local profile to send chat messages.",
          timestamp: Date.now()
        });
        return;
      }

      const normalizedText = text.trim();
      if (!normalizedText) {
        return;
      }

      if (normalizedText.length > CHAT_MAX_MESSAGE_LENGTH) {
        emitError({
          code: "TOO_LONG",
          message: `Message limit is ${CHAT_MAX_MESSAGE_LENGTH} characters.`,
          timestamp: Date.now()
        });
        return;
      }

      connectedRoom.send("chat:send", {
        userId: identity.userId,
        nickname: identity.nickname,
        championName: identity.championName,
        championLevel: identity.championLevel,
        text: normalizedText
      });
    },
    onHistory: (callback) => {
      historyListeners.add(callback);
      callback(latestHistory);
      return () => {
        historyListeners.delete(callback);
      };
    },
    onMessage: (callback) => {
      messageListeners.add(callback);
      return () => {
        messageListeners.delete(callback);
      };
    },
    onError: (callback) => {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    onPresence: (callback) => {
      presenceListeners.add(callback);
      callback(latestPresence);
      return () => {
        presenceListeners.delete(callback);
      };
    },
    disconnect: () => {
      if (!room) {
        return;
      }

      suppressNextDisconnectError = true;
      void room.leave();
      room = null;
    }
  };
}
