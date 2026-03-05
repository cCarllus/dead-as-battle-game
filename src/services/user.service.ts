// Responsável por orquestrar regras de negócio de usuário, campeões e seleção atual.
import { DEFAULT_CHAMPION_ID, CHAMPION_IDS, isChampionId } from "../data/champions.catalog";
import type { ChampionId } from "../models/champion.model";
import {
  DEFAULT_NICKNAME,
  createUserProfile,
  normalizeNickname,
  sanitizeCreatedAt,
  sanitizeChampionProgress,
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

function normalizeNicknameOrDefault(value: unknown, fallback: string = DEFAULT_NICKNAME): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return normalizeNickname(value) ?? fallback;
}

function normalizeChampionsRecord(value: unknown): Record<ChampionId, ChampionProgress> {
  const rawChampions = isObjectRecord(value) ? value : {};

  return CHAMPION_IDS.reduce((acc, championId) => {
    acc[championId] = sanitizeChampionProgress(rawChampions[championId]);
    return acc;
  }, {} as Record<ChampionId, ChampionProgress>);
}

function resolveLegacySelectedChampionId(rawProfile: Record<string, unknown>): string | undefined {
  const entry = Object.entries(rawProfile).find(([key, value]) => {
    return key.startsWith("selected") && key.endsWith("Id") && typeof value === "string";
  });

  return typeof entry?.[1] === "string" ? entry[1] : undefined;
}

function resolveLegacyChampionProgress(rawProfile: Record<string, unknown>): unknown {
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

function normalizeLoadedProfile(rawProfile: unknown): UserProfile | null {
  if (!isObjectRecord(rawProfile)) {
    return null;
  }

  const selectedChampionCandidate =
    typeof rawProfile.selectedChampionId === "string"
      ? rawProfile.selectedChampionId
      : resolveLegacySelectedChampionId(rawProfile);
  const selectedChampionId = isChampionId(selectedChampionCandidate) ? selectedChampionCandidate : DEFAULT_CHAMPION_ID;
  const rawChampionProgress = rawProfile.champions ?? resolveLegacyChampionProgress(rawProfile);

  return {
    id: typeof rawProfile.id === "string" && rawProfile.id.length > 0 ? rawProfile.id : createAnonymousId(),
    nickname: normalizeNicknameOrDefault(rawProfile.nickname),
    createdAt: sanitizeCreatedAt(rawProfile.createdAt),
    selectedChampionId,
    champions: normalizeChampionsRecord(rawChampionProgress)
  };
}

export function migrateUserChampions(profile: UserProfile): UserProfile {
  const migratedChampions = normalizeChampionsRecord(profile.champions);
  const selectedChampionId = isChampionId(profile.selectedChampionId) ? profile.selectedChampionId : DEFAULT_CHAMPION_ID;

  return {
    ...profile,
    selectedChampionId,
    champions: migratedChampions
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

    const normalizedProfile = normalizeLoadedProfile(rawProfile);
    if (!normalizedProfile) {
      return null;
    }

    const migratedProfile = migrateUserChampions(normalizedProfile);
    repository.save(migratedProfile);
    return migratedProfile;
  };

  return {
    hasUserProfile: () => repository.load() !== null,
    getCurrentUser: () => loadNormalizedUser(),
    ensureUserProfile: (nickname) => {
      const existingProfile = loadNormalizedUser();
      if (existingProfile) {
        return existingProfile;
      }

      const normalizedNickname = normalizeNickname(nickname ?? "") ?? DEFAULT_NICKNAME;
      const freshProfile = createUserProfile({
        nickname: normalizedNickname,
        championIds: CHAMPION_IDS,
        selectedChampionId: DEFAULT_CHAMPION_ID
      });

      repository.save(freshProfile);
      return freshProfile;
    },
    registerUser: (nickname) => {
      const normalizedNickname = normalizeNickname(nickname);
      if (!normalizedNickname) {
        throw new Error("Nickname inválido para criação de usuário.");
      }

      const userProfile = createUserProfile({
        nickname: normalizedNickname,
        championIds: CHAMPION_IDS,
        selectedChampionId: DEFAULT_CHAMPION_ID
      });

      repository.save(userProfile);
      return userProfile;
    },
    clearCurrentUser: () => {
      repository.clear();
    },
    selectChampion: (championId) => {
      if (!isChampionId(championId)) {
        return;
      }

      const currentProfile = loadNormalizedUser();
      if (!currentProfile) {
        return;
      }

      const nowIso = new Date().toISOString();
      const selectedProgress = currentProfile.champions[championId] ?? sanitizeChampionProgress(null);

      const nextProfile: UserProfile = {
        ...currentProfile,
        selectedChampionId: championId,
        champions: {
          ...currentProfile.champions,
          [championId]: {
            ...selectedProgress,
            lastPlayedAt: nowIso
          }
        }
      };

      repository.save(nextProfile);
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
