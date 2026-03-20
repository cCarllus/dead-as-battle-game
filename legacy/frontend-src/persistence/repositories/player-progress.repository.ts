import { APP_VERSION_LABEL } from "../../config/version";
import {
  DEFAULT_GAME_SETTINGS,
  cloneGameSettings,
  normalizeGameSettings,
  type GameSettings
} from "../../config/game-settings";
import {
  CHAMPION_IDS,
  DEFAULT_CHAMPION_ID,
  isChampionId,
  isDefaultChampionId
} from "../../data/champions.catalog";
import { sanitizeNotifications } from "../../models/notification.model";
import {
  DEFAULT_NICKNAME,
  createUserProfile,
  normalizeNickname,
  sanitizeChampionProgress,
  sanitizeCreatedAt,
  type ChampionProgress,
  type UserProfile
} from "../../models/user.model";
import { MAX_PENDING_COIN_REWARDS } from "../../models/reward.model";
import { createJsonProgressStorage, type JsonProgressStorage } from "../storage/json-progress.storage";
import { type PlayerProgressMetadata, type PlayerProgressState } from "../types/player-progress.types";

const LEGACY_USER_STORAGE_KEY = "dab:user";
const LEGACY_SETTINGS_STORAGE_KEY = "dab:settings";
const STATE_RECORD_VERSION = 1;

type LegacyStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredPlayerProgressRecord = {
  version: number;
  gameVersion: string;
  profile: unknown | null;
  settings: unknown;
  metadata: PlayerProgressMetadata;
};

export type PlayerProgressRepository = {
  loadState: () => PlayerProgressState;
  saveState: (state: PlayerProgressState) => PlayerProgressState;
  loadProfile: () => UserProfile | null;
  saveProfile: (profile: UserProfile | null) => UserProfile | null;
  clearProfile: () => void;
  loadSettings: () => GameSettings;
  saveSettings: (settings: GameSettings) => GameSettings;
  clearAll: () => void;
};

export type PlayerProgressRepositoryDependencies = {
  storage: JsonProgressStorage;
  legacyStorage: LegacyStorageAdapter;
};

function nowIso(): string {
  return new Date().toISOString();
}

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

function normalizeChampionIdCandidate(value: unknown): UserProfile["selectedChampionId"] {
  const normalizedValue = typeof value === "string" ? value : undefined;
  return isChampionId(normalizedValue) ? normalizedValue : DEFAULT_CHAMPION_ID;
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

function normalizeChampionProgressRecord(value: unknown): Record<UserProfile["selectedChampionId"], ChampionProgress> {
  const rawRecord = isObjectRecord(value) ? value : {};

  return CHAMPION_IDS.reduce((acc, championId) => {
    const progress = sanitizeChampionProgress(rawRecord[championId], {
      isUnlockedDefault: isDefaultChampionId(championId)
    });

    acc[championId] = {
      ...progress,
      isUnlocked: progress.isUnlocked || isDefaultChampionId(championId)
    };
    return acc;
  }, {} as Record<UserProfile["selectedChampionId"], ChampionProgress>);
}

function isChampionUnlocked(user: Pick<UserProfile, "champions">, championId: UserProfile["selectedChampionId"]): boolean {
  if (isDefaultChampionId(championId)) {
    return true;
  }

  return user.champions[championId]?.isUnlocked === true;
}

function resolveSafeSelectedChampionId(
  user: Pick<UserProfile, "selectedChampionId" | "champions">
): UserProfile["selectedChampionId"] {
  const selectedChampionId = normalizeChampionIdCandidate(user.selectedChampionId);

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

  const selectedChampionId = normalizeChampionIdCandidate(selectedCandidate);
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

function createEmptyState(now: string = nowIso()): PlayerProgressState {
  return {
    profile: null,
    settings: cloneGameSettings(DEFAULT_GAME_SETTINGS),
    metadata: {
      createdAt: now,
      updatedAt: now
    }
  };
}

function sanitizeMetadata(value: unknown): PlayerProgressMetadata {
  const fallback = nowIso();
  if (!isObjectRecord(value)) {
    return {
      createdAt: fallback,
      updatedAt: fallback
    };
  }

  return {
    createdAt: sanitizeCreatedAt(value.createdAt),
    updatedAt: sanitizeCreatedAt(value.updatedAt)
  };
}

function toStoredRecord(state: PlayerProgressState): StoredPlayerProgressRecord {
  return {
    version: STATE_RECORD_VERSION,
    gameVersion: APP_VERSION_LABEL,
    profile: state.profile,
    settings: state.settings,
    metadata: state.metadata
  };
}

function normalizeStateRecord(record: unknown): PlayerProgressState | null {
  if (!isObjectRecord(record)) {
    return null;
  }

  return {
    profile: normalizeLoadedUser(record.profile),
    settings: normalizeGameSettings(record.settings),
    metadata: sanitizeMetadata(record.metadata)
  };
}

function parseLegacyJson(rawValue: string | null): unknown | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

function buildLegacyState(legacyStorage: LegacyStorageAdapter): PlayerProgressState | null {
  const legacyUser = parseLegacyJson(legacyStorage.getItem(LEGACY_USER_STORAGE_KEY));
  const legacySettings = parseLegacyJson(legacyStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY));

  if (legacyUser === null && legacySettings === null) {
    return null;
  }

  const now = nowIso();

  return {
    profile: normalizeLoadedUser(legacyUser),
    settings: normalizeGameSettings(legacySettings),
    metadata: {
      createdAt: now,
      updatedAt: now
    }
  };
}

function normalizeState(state: PlayerProgressState, previousState?: PlayerProgressState): PlayerProgressState {
  const normalizedProfile = state.profile ? normalizeLoadedUser(state.profile) : null;
  const normalizedSettings = normalizeGameSettings(state.settings);
  const now = nowIso();

  return {
    profile: normalizedProfile,
    settings: normalizedSettings,
    metadata: {
      createdAt: previousState?.metadata.createdAt ?? state.metadata.createdAt ?? now,
      updatedAt: now
    }
  };
}

function createDefaultProfile(nickname?: string): UserProfile {
  const normalizedNickname = normalizeNickname(nickname ?? "") ?? DEFAULT_NICKNAME;

  return createUserProfile({
    nickname: normalizedNickname,
    championIds: CHAMPION_IDS,
    defaultUnlockedChampionIds: [DEFAULT_CHAMPION_ID],
    selectedChampionId: DEFAULT_CHAMPION_ID
  });
}

export function createPlayerProgressRepository({
  storage,
  legacyStorage
}: PlayerProgressRepositoryDependencies = {
  storage: createJsonProgressStorage(),
  legacyStorage: localStorage
}): PlayerProgressRepository {
  let cachedState: PlayerProgressState | null = null;

  const persistState = (state: PlayerProgressState, previousState?: PlayerProgressState): PlayerProgressState => {
    const normalized = normalizeState(state, previousState ?? cachedState ?? createEmptyState());
    storage.saveStateRecord(toStoredRecord(normalized));
    cachedState = normalized;
    return normalized;
  };

  const migrateLegacyState = (): PlayerProgressState | null => {
    const legacyState = buildLegacyState(legacyStorage);
    if (!legacyState) {
      return null;
    }

    const migratedState = persistState(legacyState, createEmptyState());
    legacyStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    legacyStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    return migratedState;
  };

  const loadState = (): PlayerProgressState => {
    if (cachedState) {
      return cachedState;
    }

    const storedRecord = storage.loadStateRecord();
    const normalizedState = normalizeStateRecord(storedRecord);

    if (normalizedState) {
      cachedState = normalizedState;
      return normalizedState;
    }

    const migratedLegacyState = migrateLegacyState();
    if (migratedLegacyState) {
      return migratedLegacyState;
    }

    const emptyState = createEmptyState();
    cachedState = emptyState;
    return emptyState;
  };

  return {
    loadState,
    saveState: (state) => persistState(state),
    loadProfile: () => {
      return loadState().profile;
    },
    saveProfile: (profile) => {
      const previousState = loadState();
      const nextState = persistState({
        ...previousState,
        profile
      }, previousState);
      return nextState.profile;
    },
    clearProfile: () => {
      const previousState = loadState();
      persistState({
        ...previousState,
        profile: null
      }, previousState);
    },
    loadSettings: () => {
      return cloneGameSettings(loadState().settings);
    },
    saveSettings: (settings) => {
      const previousState = loadState();
      return persistState({
        ...previousState,
        settings
      }, previousState).settings;
    },
    clearAll: () => {
      cachedState = createEmptyState();
      storage.clearStateRecord();
      legacyStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      legacyStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    }
  };
}

export { createDefaultProfile };
