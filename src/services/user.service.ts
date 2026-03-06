// Responsável por regras de negócio de usuário, migração de perfil e seleção persistida de campeão.
import {
  CHAMPION_IDS,
  DEFAULT_CHAMPION_ID,
  isChampionId,
  isDefaultChampionId
} from "../data/champions.catalog";
import type { ChampionId } from "../models/champion.model";
import { MAX_PENDING_COIN_REWARDS } from "../models/reward.model";
import {
  DEFAULT_NICKNAME,
  createUserProfile,
  normalizeNickname,
  sanitizeChampionProgress,
  sanitizeCreatedAt,
  type ChampionProgress,
  type UserProfile
} from "../models/user.model";
import { sanitizeNotifications } from "../models/notification.model";
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

function toSafeCounter(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return 0;
  }

  return Math.max(0, Math.floor(normalized));
}

function clampPendingRewards(value: unknown): number {
  return Math.min(MAX_PENDING_COIN_REWARDS, toSafeCounter(value));
}

function resolveLegacySelectedChampionId(rawProfile: Record<string, unknown>): string | undefined {
  const legacyEntry = Object.entries(rawProfile).find(([key, entryValue]) => {
    return key.startsWith("selected") && key.endsWith("Id") && typeof entryValue === "string";
  });

  return typeof legacyEntry?.[1] === "string" ? legacyEntry[1] : undefined;
}

function resolveLegacyChampionRecord(rawProfile: Record<string, unknown>): unknown {
  const legacyEntry = Object.entries(rawProfile).find(([key, entryValue]) => {
    if (key === "champions" || !isObjectRecord(entryValue)) {
      return false;
    }

    const sample = Object.values(entryValue)[0];
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
    const progress = sanitizeChampionProgress(rawRecord[championId], {
      isUnlockedDefault: isDefaultChampionId(championId)
    });

    if (isDefaultChampionId(championId)) {
      progress.isUnlocked = true;
    }

    acc[championId] = progress;
    return acc;
  }, {} as Record<ChampionId, ChampionProgress>);
}

function isChampionUnlocked(user: Pick<UserProfile, "champions">, championId: ChampionId): boolean {
  if (isDefaultChampionId(championId)) {
    return true;
  }

  return user.champions[championId]?.isUnlocked === true;
}

function resolveSafeSelectedChampionId(user: Pick<UserProfile, "selectedChampionId" | "champions">): ChampionId {
  const selectedChampionId = isChampionId(user.selectedChampionId)
    ? user.selectedChampionId
    : DEFAULT_CHAMPION_ID;

  if (isChampionUnlocked(user, selectedChampionId)) {
    return selectedChampionId;
  }

  return DEFAULT_CHAMPION_ID;
}

function normalizeLoadedUser(rawProfile: unknown): UserProfile | null {
  if (!isObjectRecord(rawProfile)) {
    return null;
  }

  const selectedCandidate =
    typeof rawProfile.selectedChampionId === "string"
      ? rawProfile.selectedChampionId
      : resolveLegacySelectedChampionId(rawProfile);

  const selectedChampionId = isChampionId(selectedCandidate)
    ? selectedCandidate
    : DEFAULT_CHAMPION_ID;
  const rawChampionProgress = rawProfile.champions ?? resolveLegacyChampionRecord(rawProfile);

  const normalizedUser: UserProfile = {
    id: typeof rawProfile.id === "string" && rawProfile.id.length > 0 ? rawProfile.id : createAnonymousId(),
    nickname: normalizeNicknameOrDefault(rawProfile.nickname),
    createdAt: sanitizeCreatedAt(rawProfile.createdAt),
    selectedChampionId,
    coins: toSafeCounter(rawProfile.coins),
    activePlayTimeSeconds: toSafeCounter(rawProfile.activePlayTimeSeconds),
    pendingCoinRewards: clampPendingRewards(rawProfile.pendingCoinRewards),
    notifications: sanitizeNotifications(rawProfile.notifications),
    champions: normalizeChampionProgressRecord(rawChampionProgress)
  };

  return {
    ...normalizedUser,
    selectedChampionId: resolveSafeSelectedChampionId(normalizedUser)
  };
}

export function migrateUserChampions(user: UserProfile): UserProfile {
  const champions = normalizeChampionProgressRecord(user.champions);
  const migratedUser: UserProfile = {
    ...user,
    coins: toSafeCounter(user.coins),
    activePlayTimeSeconds: toSafeCounter(user.activePlayTimeSeconds),
    pendingCoinRewards: clampPendingRewards(user.pendingCoinRewards),
    notifications: sanitizeNotifications(user.notifications),
    champions,
    selectedChampionId: isChampionId(user.selectedChampionId)
      ? user.selectedChampionId
      : DEFAULT_CHAMPION_ID
  };

  return {
    ...migratedUser,
    selectedChampionId: resolveSafeSelectedChampionId(migratedUser)
  };
}

export type UserService = {
  hasUserProfile: () => boolean;
  getCurrentUser: () => UserProfile | null;
  ensureUserProfile: (nickname?: string) => UserProfile;
  registerUser: (nickname: string) => UserProfile;
  clearCurrentUser: () => void;
  selectChampion: (championId: ChampionId) => boolean;
  updateCurrentUser: (updater: (user: UserProfile) => UserProfile) => UserProfile | null;
  addCoins: (amount: number) => UserProfile | null;
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

  const updateCurrentUser = (updater: (user: UserProfile) => UserProfile): UserProfile | null => {
    const currentUser = loadNormalizedUser();
    if (!currentUser) {
      return null;
    }

    const nextUser = migrateUserChampions(updater(currentUser));
    repository.save(nextUser);
    return nextUser;
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
        defaultUnlockedChampionIds: [DEFAULT_CHAMPION_ID],
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
        defaultUnlockedChampionIds: [DEFAULT_CHAMPION_ID],
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
        return false;
      }

      let didSelect = false;

      updateCurrentUser((user) => {
        if (!isChampionUnlocked(user, championId)) {
          return user;
        }

        didSelect = true;
        const now = new Date().toISOString();
        const selectedProgress =
          user.champions[championId] ??
          sanitizeChampionProgress(null, {
            isUnlockedDefault: isDefaultChampionId(championId)
          });

        return {
          ...user,
          selectedChampionId: championId,
          champions: {
            ...user.champions,
            [championId]: {
              ...selectedProgress,
              isUnlocked: selectedProgress.isUnlocked || isDefaultChampionId(championId),
              lastSelectedAt: now
            }
          }
        };
      });

      return didSelect;
    },
    updateCurrentUser,
    addCoins: (amount) => {
      const normalizedAmount = Number.isFinite(amount) ? Math.floor(amount) : 0;
      if (normalizedAmount <= 0) {
        return loadNormalizedUser();
      }

      return updateCurrentUser((user) => ({
        ...user,
        coins: user.coins + normalizedAmount
      }));
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
