// Responsável por tipar e normalizar o perfil de usuário local e progresso por campeão.
import type { ChampionId } from "./champion.model";

export const MIN_NICKNAME_LENGTH = 3;
export const MAX_NICKNAME_LENGTH = 16;
export const DEFAULT_NICKNAME = "Player";

export type ChampionProgress = {
  level: number;
  xp: number;
  kills: number;
  deaths: number;
  lastPlayedAt?: string;
};

export type UserProfile = {
  id: string;
  nickname: string;
  createdAt: string;
  selectedChampionId: ChampionId;
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

export function createDefaultChampionProgress(): ChampionProgress {
  return {
    level: 1,
    xp: 0,
    kills: 0,
    deaths: 0
  };
}

export function sanitizeChampionProgress(value: unknown): ChampionProgress {
  if (!value || typeof value !== "object") {
    return createDefaultChampionProgress();
  }

  const progress = value as Partial<ChampionProgress>;

  const sanitized: ChampionProgress = {
    level: toSafeLevel(Number(progress.level ?? 1)),
    xp: toSafeCounter(Number(progress.xp ?? 0), 0),
    kills: toSafeCounter(Number(progress.kills ?? 0), 0),
    deaths: toSafeCounter(Number(progress.deaths ?? 0), 0)
  };

  if (isValidIsoDate(progress.lastPlayedAt)) {
    sanitized.lastPlayedAt = progress.lastPlayedAt;
  }

  return sanitized;
}

export function createUserProfile(params: {
  nickname: string;
  championIds: readonly ChampionId[];
  selectedChampionId: ChampionId;
  now?: Date;
}): UserProfile {
  const normalizedNickname = normalizeNickname(params.nickname) ?? DEFAULT_NICKNAME;
  const createdAt = (params.now ?? new Date()).toISOString();

  const champions = params.championIds.reduce((acc, championId) => {
    acc[championId] = createDefaultChampionProgress();
    return acc;
  }, {} as Record<ChampionId, ChampionProgress>);

  return {
    id: createUserId(),
    nickname: normalizedNickname,
    createdAt,
    selectedChampionId: params.selectedChampionId,
    champions
  };
}

export function sanitizeCreatedAt(value: unknown): string {
  if (isValidIsoDate(value)) {
    return value;
  }

  return new Date().toISOString();
}
