import { randomUUID } from "node:crypto";
import { Room, Client } from "@colyseus/core";
import type { ChatMessage } from "../models/chat-message.model.js";
import { ChatHistoryService } from "../services/chat-history.service.js";
import { AntiSpamService } from "../services/anti-spam.service.js";

type ChatSendPayload = {
  userId?: unknown;
  nickname?: unknown;
  championName?: unknown;
  championLevel?: unknown;
  text?: unknown;
};

type JoinOptions = {
  userId?: unknown;
  nickname?: unknown;
  championName?: unknown;
  championLevel?: unknown;
};

type ChatAuthor = {
  userId: string;
  nickname: string;
  championName: string;
  championLevel: number;
};

type ChatErrorCode = "EMPTY" | "TOO_LONG" | "COOLDOWN";

const CHAT_SEND_EVENT = "chat:send";
const CHAT_MESSAGE_EVENT = "chat:message";
const CHAT_HISTORY_EVENT = "chat:history";
const CHAT_ERROR_EVENT = "chat:error";

const MAX_HISTORY_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 200;
const MAX_NICKNAME_LENGTH = 24;
const MAX_CHAMPION_NAME_LENGTH = 28;
const CHAT_COOLDOWN_MS = 1000;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNickname(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_NICKNAME_LENGTH);
}

function normalizeChampionName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_CHAMPION_NAME_LENGTH);
}

function normalizeChampionLevel(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized >= 1 ? normalized : null;
}

function createMessageId(): string {
  return randomUUID();
}

export class GlobalChatRoom extends Room {
  private readonly history = new ChatHistoryService(MAX_HISTORY_MESSAGES);
  private readonly antiSpam = new AntiSpamService(CHAT_COOLDOWN_MS);
  private readonly participantBySessionId = new Map<string, ChatAuthor>();

  onCreate(): void {
    // Mantem a sala viva mesmo sem clientes para preservar historico em memoria.
    this.autoDispose = false;

    this.onMessage(CHAT_SEND_EVENT, (client, payload: ChatSendPayload) => {
      this.handleChatSend(client, payload);
    });
  }

  onJoin(client: Client, options?: JoinOptions): void {
    const userId = normalizeUserId(options?.userId) ?? client.sessionId;
    const nickname = normalizeNickname(options?.nickname) ?? "Player";
    const championName = normalizeChampionName(options?.championName) ?? "Unknown";
    const championLevel = normalizeChampionLevel(options?.championLevel) ?? 1;

    this.participantBySessionId.set(client.sessionId, {
      userId,
      nickname,
      championName,
      championLevel
    });
    client.send(CHAT_HISTORY_EVENT, this.history.getHistory());
  }

  onLeave(client: Client): void {
    this.participantBySessionId.delete(client.sessionId);
  }

  private handleChatSend(client: Client, payload: ChatSendPayload): void {
    const text = normalizeText(payload?.text);
    if (!text) {
      this.sendChatError(client, "EMPTY", "Empty messages are not allowed.");
      return;
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      this.sendChatError(client, "TOO_LONG", `Message limit is ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    const fallbackAuthor = this.participantBySessionId.get(client.sessionId);
    const userId =
      fallbackAuthor?.userId ??
      normalizeUserId(payload?.userId) ??
      client.sessionId;

    if (!this.antiSpam.canSend(userId)) {
      this.sendChatError(client, "COOLDOWN", "Please wait before sending another message.");
      return;
    }

    const nickname =
      fallbackAuthor?.nickname ??
      normalizeNickname(payload?.nickname) ??
      "Player";
    const championName =
      normalizeChampionName(payload?.championName) ??
      fallbackAuthor?.championName ??
      "Unknown";
    const championLevel =
      normalizeChampionLevel(payload?.championLevel) ??
      fallbackAuthor?.championLevel ??
      1;

    this.participantBySessionId.set(client.sessionId, {
      userId,
      nickname,
      championName,
      championLevel
    });

    const message: ChatMessage = {
      id: createMessageId(),
      userId,
      nickname,
      championName,
      championLevel,
      text,
      timestamp: Date.now()
    };

    this.history.addMessage(message);
    this.broadcast(CHAT_MESSAGE_EVENT, message);
  }

  private sendChatError(client: Client, code: ChatErrorCode, message: string): void {
    client.send(CHAT_ERROR_EVENT, {
      code,
      message,
      timestamp: Date.now()
    });
  }
}
