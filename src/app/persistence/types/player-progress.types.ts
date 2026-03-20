import type { GameSettings } from "../../config/game-settings";
import type { ChampionId } from "../../models/champion.model";
import type { NotificationItem } from "../../models/notification.model";
import type { ChampionProgress, UserProfile } from "../../models/user.model";

export const PLAYER_PROGRESS_SAVE_VERSION = 1;
export const PLAYER_PROGRESS_SIGNATURE_ALGORITHM = "fnv1a-64";

export type PersistedChampionProgress = {
  championId: ChampionId;
  level: number;
  xp: number;
  kills: number;
  deaths: number;
  isUnlocked: boolean;
  createdAt: string;
  lastSelectedAt?: string;
};

export type PlayerProgressProfilePayload = {
  nickname: string;
  createdAt: string;
  coins: number;
  activePlayTimeSeconds: number;
  pendingCoinRewards: number;
  notifications: NotificationItem[];
};

export type PlayerProgressMetadata = {
  createdAt: string;
  updatedAt: string;
};

export type PlayerProgressIntegrity = {
  algorithm: typeof PLAYER_PROGRESS_SIGNATURE_ALGORITHM;
  signature: string;
};

export type PlayerProgressPayload = {
  saveVersion: typeof PLAYER_PROGRESS_SAVE_VERSION;
  gameVersion: string;
  playerId: string;
  profile: PlayerProgressProfilePayload;
  champions: PersistedChampionProgress[];
  selectedChampionId: ChampionId;
  settings: GameSettings;
  metadata: PlayerProgressMetadata;
};

export type PlayerProgressDocument = PlayerProgressPayload & {
  integrity: PlayerProgressIntegrity;
};

export type PlayerProgressState = {
  profile: UserProfile | null;
  settings: GameSettings;
  metadata: PlayerProgressMetadata;
};

export type PlayerProgressImportPreview = {
  playerId: string;
  nickname: string;
  selectedChampionId: ChampionId;
  championCount: number;
  coins: number;
  locale: GameSettings["locale"];
  updatedAt: string;
  warnings: string[];
};

export function championProgressToPersisted(
  championId: ChampionId,
  progress: ChampionProgress
): PersistedChampionProgress {
  return {
    championId,
    level: progress.level,
    xp: progress.xp,
    kills: progress.kills,
    deaths: progress.deaths,
    isUnlocked: progress.isUnlocked,
    createdAt: progress.createdAt,
    lastSelectedAt: progress.lastSelectedAt
  };
}

export function persistedChampionsToRecord(
  champions: readonly PersistedChampionProgress[]
): Record<ChampionId, ChampionProgress> {
  return champions.reduce(
    (acc, champion) => {
      acc[champion.championId] = {
        level: champion.level,
        xp: champion.xp,
        kills: champion.kills,
        deaths: champion.deaths,
        isUnlocked: champion.isUnlocked,
        createdAt: champion.createdAt,
        lastSelectedAt: champion.lastSelectedAt
      };
      return acc;
    },
    {} as Record<ChampionId, ChampionProgress>
  );
}
