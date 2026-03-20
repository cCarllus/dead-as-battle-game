// Responsável por tipar e normalizar o perfil local do usuário com progresso por campeão.
import type { ChampionId } from "@/shared/champions/champion.model";
import type { NotificationItem } from "@/shared/notifications/notification.model";

export const MIN_NICKNAME_LENGTH = 3;
export const MAX_NICKNAME_LENGTH = 16;
export const DEFAULT_NICKNAME = "Player";

export type ChampionProgress = {
  level: number;
  xp: number;
  kills: number;
  deaths: number;
  isUnlocked: boolean;
  createdAt: string;
  lastSelectedAt?: string;
};

export type UserProfile = {
  id: string;
  nickname: string;
  createdAt: string;
  selectedChampionId: ChampionId;
  coins: number;
  activePlayTimeSeconds: number;
  pendingCoinRewards: number;
  notifications: NotificationItem[];
  champions: Record<ChampionId, ChampionProgress>;
};

function createUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toSafeCounter(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function toSafeLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

export function normalizeNickname(nickname: string): string | null {
  const normalized = nickname.trim();
  const isValidLength =
    normalized.length >= MIN_NICKNAME_LENGTH && normalized.length <= MAX_NICKNAME_LENGTH;

  return isValidLength ? normalized : null;
}

export function createDefaultChampionProgress(params?: {
  now?: Date;
  isUnlocked?: boolean;
}): ChampionProgress {
  const now = params?.now ?? new Date();

  return {
    level: 1,
    xp: 0,
    kills: 0,
    deaths: 0,
    isUnlocked: params?.isUnlocked === true,
    createdAt: now.toISOString()
  };
}

export function sanitizeChampionProgress(
  value: unknown,
  options?: {
    isUnlockedDefault?: boolean;
  }
): ChampionProgress {
  if (!value || typeof value !== "object") {
    return createDefaultChampionProgress({
      isUnlocked: options?.isUnlockedDefault === true
    });
  }

  const progress = value as Partial<ChampionProgress>;

  const sanitized: ChampionProgress = {
    level: toSafeLevel(Number(progress.level ?? 1)),
    xp: toSafeCounter(Number(progress.xp ?? 0), 0),
    kills: toSafeCounter(Number(progress.kills ?? 0), 0),
    deaths: toSafeCounter(Number(progress.deaths ?? 0), 0),
    isUnlocked:
      typeof progress.isUnlocked === "boolean"
        ? progress.isUnlocked
        : options?.isUnlockedDefault === true,
    createdAt: isValidIsoDate(progress.createdAt) ? progress.createdAt : new Date().toISOString()
  };

  if (isValidIsoDate(progress.lastSelectedAt)) {
    sanitized.lastSelectedAt = progress.lastSelectedAt;
  }

  return sanitized;
}

export function createUserProfile(params: {
  nickname: string;
  championIds: readonly ChampionId[];
  defaultUnlockedChampionIds: readonly ChampionId[];
  selectedChampionId: ChampionId;
  now?: Date;
}): UserProfile {
  const normalizedNickname = normalizeNickname(params.nickname) ?? DEFAULT_NICKNAME;
  const now = params.now ?? new Date();
  const createdAt = now.toISOString();
  const defaultUnlockedChampionIdSet = new Set<ChampionId>(params.defaultUnlockedChampionIds);

  const champions = params.championIds.reduce((acc, championId) => {
    acc[championId] = createDefaultChampionProgress({
      now,
      isUnlocked: defaultUnlockedChampionIdSet.has(championId)
    });
    return acc;
  }, {} as Record<ChampionId, ChampionProgress>);

  return {
    id: createUserId(),
    nickname: normalizedNickname,
    createdAt,
    selectedChampionId: params.selectedChampionId,
    coins: 0,
    activePlayTimeSeconds: 0,
    pendingCoinRewards: 0,
    notifications: [],
    champions
  };
}

export function sanitizeCreatedAt(value: unknown): string {
  if (isValidIsoDate(value)) {
    return value;
  }

  return new Date().toISOString();
}
