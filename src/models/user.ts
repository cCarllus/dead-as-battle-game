export const USER_MODEL_VERSION = 1;
export const MIN_NICKNAME_LENGTH = 3;
export const MAX_NICKNAME_LENGTH = 16;

export type MatchResult = {
  kills: number;
  deaths: number;
};

export type UserStats = {
  kills: number;
  deaths: number;
  matches: number;
};

export type UserModel = {
  id: string;
  version: number;
  nickname: string;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
};

export function getUserLevel(user: UserModel): number {
  return 1 + Math.floor(user.stats.matches / 5);
}

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function generateUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeCounter(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

export function normalizeNickname(nickname: string): string | null {
  const normalized = nickname.trim();
  if (normalized.length < MIN_NICKNAME_LENGTH || normalized.length > MAX_NICKNAME_LENGTH) {
    return null;
  }

  return normalized;
}

export function createUserModel(nickname: string, now = new Date()): UserModel {
  const normalized = normalizeNickname(nickname);
  if (!normalized) {
    throw new Error("Nickname inválido para criação de usuário.");
  }

  const timestamp = nowIso(now);
  return {
    id: generateUserId(),
    version: USER_MODEL_VERSION,
    nickname: normalized,
    stats: {
      kills: 0,
      deaths: 0,
      matches: 0
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function withMatchResult(user: UserModel, matchResult: MatchResult, now = new Date()): UserModel {
  return {
    ...user,
    stats: {
      kills: sanitizeCounter(user.stats.kills + sanitizeCounter(matchResult.kills)),
      deaths: sanitizeCounter(user.stats.deaths + sanitizeCounter(matchResult.deaths)),
      matches: sanitizeCounter(user.stats.matches + 1)
    },
    updatedAt: nowIso(now)
  };
}

export function isUserModel(value: unknown): value is UserModel {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as UserModel;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.nickname !== "string" ||
    candidate.version !== USER_MODEL_VERSION ||
    !candidate.stats ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return false;
  }

  return (
    Number.isFinite(candidate.stats.kills) &&
    Number.isFinite(candidate.stats.deaths) &&
    Number.isFinite(candidate.stats.matches)
  );
}
