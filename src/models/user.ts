// Responsável por concentrar regras de domínio, validação e evolução do modelo de usuário.
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

const INITIAL_USER_STATS: UserStats = {
  kills: 0,
  deaths: 0,
  matches: 0
};

function createIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

function createUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toSafeCounter(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function isValidUserStats(value: unknown): value is UserStats {
  if (!value || typeof value !== "object") {
    return false;
  }

  const stats = value as UserStats;
  return (
    Number.isFinite(stats.kills) &&
    Number.isFinite(stats.deaths) &&
    Number.isFinite(stats.matches)
  );
}

export function normalizeNickname(nickname: string): string | null {
  const normalized = nickname.trim();
  const hasValidLength =
    normalized.length >= MIN_NICKNAME_LENGTH && normalized.length <= MAX_NICKNAME_LENGTH;

  return hasValidLength ? normalized : null;
}

export function createUserModel(nickname: string, now: Date = new Date()): UserModel {
  const normalizedNickname = normalizeNickname(nickname);
  if (!normalizedNickname) {
    throw new Error("Nickname inválido para criação de usuário.");
  }

  const timestamp = createIsoTimestamp(now);

  return {
    id: createUserId(),
    version: USER_MODEL_VERSION,
    nickname: normalizedNickname,
    stats: { ...INITIAL_USER_STATS },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function applyMatchResult(user: UserModel, matchResult: MatchResult, now: Date = new Date()): UserModel {
  return {
    ...user,
    stats: {
      kills: toSafeCounter(user.stats.kills + toSafeCounter(matchResult.kills)),
      deaths: toSafeCounter(user.stats.deaths + toSafeCounter(matchResult.deaths)),
      matches: toSafeCounter(user.stats.matches + 1)
    },
    updatedAt: createIsoTimestamp(now)
  };
}

export function getUserLevel(user: UserModel): number {
  return 1 + Math.floor(user.stats.matches / 5);
}

export function isUserModel(value: unknown): value is UserModel {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as UserModel;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.nickname === "string" &&
    candidate.nickname.length > 0 &&
    candidate.version === USER_MODEL_VERSION &&
    isValidUserStats(candidate.stats) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}
