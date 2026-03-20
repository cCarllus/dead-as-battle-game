import { CHAMPION_IDS, DEFAULT_CHAMPION_ID, isChampionId, isDefaultChampionId } from "@/shared/champions/champions.catalog";
import { APP_VERSION_LABEL } from "@/config/version";
import { normalizeGameSettings } from "@/config/game-settings";
import {
  sanitizeNotificationItem,
  sanitizeNotifications,
  type NotificationItem
} from "@/shared/notifications/notification.model";
import {
  sanitizeChampionProgress,
  sanitizeCreatedAt,
  normalizeNickname,
  DEFAULT_NICKNAME,
  type UserProfile
} from "@/shared/user/user.model";
import { playerProgressDocumentSchema } from "../schemas/player-progress.schema";
import { hasValidProgressSignature } from "./progress-signature";
import {
  persistedChampionsToRecord,
  type PersistedChampionProgress,
  type PlayerProgressDocument,
  type PlayerProgressImportPreview
} from "../types/player-progress.types";

export type ProgressValidationResult =
  | {
      ok: true;
      document: PlayerProgressDocument;
      user: UserProfile;
      warnings: string[];
      preview: PlayerProgressImportPreview;
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

function isValidIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function createChampionRecord(
  persistedChampions: readonly PersistedChampionProgress[]
): Record<UserProfile["selectedChampionId"], UserProfile["champions"][UserProfile["selectedChampionId"]]> {
  const record = persistedChampionsToRecord(persistedChampions);

  return CHAMPION_IDS.reduce(
    (acc, championId) => {
      const sanitized = sanitizeChampionProgress(record[championId], {
        isUnlockedDefault: isDefaultChampionId(championId)
      });
      acc[championId] = {
        ...sanitized,
        isUnlocked: sanitized.isUnlocked || isDefaultChampionId(championId)
      };
      return acc;
    },
    {} as Record<UserProfile["selectedChampionId"], UserProfile["champions"][UserProfile["selectedChampionId"]]>
  );
}

function sanitizeNotificationsForImport(rawNotifications: unknown[]): NotificationItem[] {
  return sanitizeNotifications(
    rawNotifications.map((notification) => sanitizeNotificationItem(notification)).filter(Boolean)
  );
}

export function validatePlayerProgressDocument(value: unknown): ProgressValidationResult {
  const parsed = playerProgressDocumentSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.message),
      warnings: []
    };
  }

  const document = parsed.data;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!hasValidProgressSignature(document)) {
    errors.push("The selected file failed integrity verification.");
  }

  if (document.gameVersion !== APP_VERSION_LABEL) {
    warnings.push(
      `Save file version "${document.gameVersion}" differs from the current game version "${APP_VERSION_LABEL}".`
    );
  }

  const championIdSet = new Set<string>();
  document.champions.forEach((champion) => {
    if (championIdSet.has(champion.championId)) {
      errors.push(`Duplicate champion progress detected for "${champion.championId}".`);
    }

    championIdSet.add(champion.championId);

    if (!isChampionId(champion.championId)) {
      errors.push(`Unknown champion id "${champion.championId}".`);
    }

    if (!isValidIsoDate(champion.createdAt)) {
      errors.push(`Champion "${champion.championId}" has an invalid createdAt value.`);
    }

    if (champion.lastSelectedAt && !isValidIsoDate(champion.lastSelectedAt)) {
      errors.push(`Champion "${champion.championId}" has an invalid lastSelectedAt value.`);
    }
  });

  if (!isValidIsoDate(document.profile.createdAt)) {
    errors.push("Profile createdAt is invalid.");
  }

  if (!isValidIsoDate(document.metadata.createdAt) || !isValidIsoDate(document.metadata.updatedAt)) {
    errors.push("Metadata timestamps are invalid.");
  }

  const championRecord = createChampionRecord(document.champions);
  const selectedChampion = championRecord[document.selectedChampionId];
  if (!selectedChampion?.isUnlocked) {
    errors.push("selectedChampionId must belong to an unlocked champion.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings
    };
  }

  const sanitizedUser: UserProfile = {
    id: document.playerId,
    nickname: normalizeNickname(document.profile.nickname) ?? DEFAULT_NICKNAME,
    createdAt: sanitizeCreatedAt(document.profile.createdAt),
    selectedChampionId: selectedChampion?.isUnlocked ? document.selectedChampionId : DEFAULT_CHAMPION_ID,
    coins: document.profile.coins,
    activePlayTimeSeconds: document.profile.activePlayTimeSeconds,
    pendingCoinRewards: document.profile.pendingCoinRewards,
    notifications: sanitizeNotificationsForImport(document.profile.notifications),
    champions: championRecord
  };

  return {
    ok: true,
    document,
    user: sanitizedUser,
    warnings,
    preview: {
      playerId: document.playerId,
      nickname: sanitizedUser.nickname,
      selectedChampionId: sanitizedUser.selectedChampionId,
      championCount: document.champions.length,
      coins: document.profile.coins,
      locale: normalizeGameSettings(document.settings).locale,
      updatedAt: document.metadata.updatedAt,
      warnings
    }
  };
}
