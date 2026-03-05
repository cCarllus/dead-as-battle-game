// Responsável por regras de negócio de usuário, migração e seleção persistida de campeão.
import { CHAMPION_IDS, DEFAULT_CHAMPION_ID, isChampionId } from "../data/champions.catalog";
import type { ChampionId } from "../models/champion.model";
import {
  DEFAULT_NICKNAME,
  createUserProfile,
  normalizeNickname,
  sanitizeChampionProgress,
  sanitizeCreatedAt,
  type ChampionProgress,
  type UserProfile
} from "../models/user.model";
import type { UserRepository } from "../repositories/user.repository";
import { createUserRepository } from "../repositories/user.repository";

function createAnonymousId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeNicknameOrDefault(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_NICKNAME;
  }

  return normalizeNickname(value) ?? DEFAULT_NICKNAME;
}

function resolveLegacySelectedChampionId(rawProfile: Record<string, unknown>): string | undefined {
  const legacyEntry = Object.entries(rawProfile).find(([key, value]) => {
    return key.startsWith("selected") && key.endsWith("Id") && typeof value === "string";
  });

  return typeof legacyEntry?.[1] === "string" ? legacyEntry[1] : undefined;
}

function resolveLegacyChampionRecord(rawProfile: Record<string, unknown>): unknown {
  const legacyEntry = Object.entries(rawProfile).find(([key, value]) => {
    if (key === "champions" || !isObjectRecord(value)) {
      return false;
    }

    const sample = Object.values(value)[0];
    if (!isObjectRecord(sample)) {
      return false;
    }

    return (
      Object.prototype.hasOwnProperty.call(sample, "level") ||
      Object.prototype.hasOwnProperty.call(sample, "xp") ||
      Object.prototype.hasOwnProperty.call(sample, "kills") ||
      Object.prototype.hasOwnProperty.call(sample, "deaths")
    );
  });

  return legacyEntry?.[1];
}

function normalizeChampionProgressRecord(value: unknown): Record<ChampionId, ChampionProgress> {
  const rawRecord = isObjectRecord(value) ? value : {};

  return CHAMPION_IDS.reduce((acc, championId) => {
    acc[championId] = sanitizeChampionProgress(rawRecord[championId]);
    return acc;
  }, {} as Record<ChampionId, ChampionProgress>);
}

function normalizeLoadedUser(rawProfile: unknown): UserProfile | null {
  if (!isObjectRecord(rawProfile)) {
    return null;
  }

  const selectedCandidate =
    typeof rawProfile.selectedChampionId === "string"
      ? rawProfile.selectedChampionId
      : resolveLegacySelectedChampionId(rawProfile);

  const selectedChampionId = isChampionId(selectedCandidate) ? selectedCandidate : DEFAULT_CHAMPION_ID;
  const rawChampionProgress = rawProfile.champions ?? resolveLegacyChampionRecord(rawProfile);

  return {
    id: typeof rawProfile.id === "string" && rawProfile.id.length > 0 ? rawProfile.id : createAnonymousId(),
    nickname: normalizeNicknameOrDefault(rawProfile.nickname),
    createdAt: sanitizeCreatedAt(rawProfile.createdAt),
    selectedChampionId,
    champions: normalizeChampionProgressRecord(rawChampionProgress)
  };
}

export function migrateUserChampions(user: UserProfile): UserProfile {
  return {
    ...user,
    selectedChampionId: isChampionId(user.selectedChampionId) ? user.selectedChampionId : DEFAULT_CHAMPION_ID,
    champions: normalizeChampionProgressRecord(user.champions)
  };
}

export type UserService = {
  hasUserProfile: () => boolean;
  getCurrentUser: () => UserProfile | null;
  ensureUserProfile: (nickname?: string) => UserProfile;
  registerUser: (nickname: string) => UserProfile;
  clearCurrentUser: () => void;
  selectChampion: (championId: ChampionId) => void;
};

export type UserServiceDependencies = {
  repository: UserRepository;
};

export function createUserService({ repository }: UserServiceDependencies): UserService {
  const loadNormalizedUser = (): UserProfile | null => {
    const rawProfile = repository.load();
    if (!rawProfile) {
      return null;
    }

    const normalized = normalizeLoadedUser(rawProfile);
    if (!normalized) {
      return null;
    }

    const migrated = migrateUserChampions(normalized);
    repository.save(migrated);
    return migrated;
  };

  return {
    hasUserProfile: () => repository.load() !== null,
    getCurrentUser: () => loadNormalizedUser(),
    ensureUserProfile: (nickname) => {
      const existing = loadNormalizedUser();
      if (existing) {
        return existing;
      }

      const normalizedNickname = normalizeNickname(nickname ?? "") ?? DEFAULT_NICKNAME;
      const freshUser = createUserProfile({
        nickname: normalizedNickname,
        championIds: CHAMPION_IDS,
        selectedChampionId: DEFAULT_CHAMPION_ID
      });

      repository.save(freshUser);
      return freshUser;
    },
    registerUser: (nickname) => {
      const normalizedNickname = normalizeNickname(nickname);
      if (!normalizedNickname) {
        throw new Error("Nickname inválido para criação de usuário.");
      }

      const createdUser = createUserProfile({
        nickname: normalizedNickname,
        championIds: CHAMPION_IDS,
        selectedChampionId: DEFAULT_CHAMPION_ID
      });

      repository.save(createdUser);
      return createdUser;
    },
    clearCurrentUser: () => {
      repository.clear();
    },
    selectChampion: (championId) => {
      if (!isChampionId(championId)) {
        return;
      }

      const user = loadNormalizedUser();
      if (!user) {
        return;
      }

      const now = new Date().toISOString();
      const selectedProgress = user.champions[championId] ?? sanitizeChampionProgress(null);

      const nextUser: UserProfile = {
        ...user,
        selectedChampionId: championId,
        champions: {
          ...user.champions,
          [championId]: {
            ...selectedProgress,
            lastSelectedAt: now
          }
        }
      };

      repository.save(nextUser);
    }
  };
}

const defaultUserService = createUserService({ repository: createUserRepository() });

export function ensureUserProfile(nickname?: string): UserProfile {
  return defaultUserService.ensureUserProfile(nickname);
}

export function selectChampion(championId: ChampionId): void {
  defaultUserService.selectChampion(championId);
}
