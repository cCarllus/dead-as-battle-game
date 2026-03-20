import { z } from "zod";
import { CHAMPION_IDS } from "@/shared/champions/champions.catalog";
import { NOTIFICATION_TYPES } from "../../models/notification.model";
import {
  PLAYER_PROGRESS_SAVE_VERSION,
  PLAYER_PROGRESS_SIGNATURE_ALGORITHM
} from "../types/player-progress.types";

const championIdSchema = z.enum(CHAMPION_IDS);
const localeSchema = z.enum(["pt-BR", "en-US"]);

const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string(),
  message: z.string(),
  createdAt: z.number().int().nonnegative(),
  isRead: z.boolean(),
  actionType: z.string().optional(),
  actionPayload: z.unknown().optional()
});

const championProgressSchema = z.object({
  championId: championIdSchema,
  level: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  isUnlocked: z.boolean(),
  createdAt: z.string().min(1),
  lastSelectedAt: z.string().min(1).optional()
});

export const playerProgressPayloadSchema = z.object({
  saveVersion: z.literal(PLAYER_PROGRESS_SAVE_VERSION),
  gameVersion: z.string().min(1),
  playerId: z.string().min(1),
  profile: z.object({
    nickname: z.string().min(1),
    createdAt: z.string().min(1),
    coins: z.number().int().nonnegative(),
    activePlayTimeSeconds: z.number().int().nonnegative(),
    pendingCoinRewards: z.number().int().nonnegative(),
    notifications: z.array(notificationSchema)
  }),
  champions: z.array(championProgressSchema),
  selectedChampionId: championIdSchema,
  settings: z.object({
    locale: localeSchema,
    fullscreen: z.boolean(),
    muteAll: z.boolean(),
    masterVolume: z.number().int().min(0).max(100),
    cameraFovPercent: z.number().int().min(1).max(100),
    renderDistanceViewPercent: z.number().int().min(1).max(100)
  }),
  metadata: z.object({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
});

export const playerProgressDocumentSchema = playerProgressPayloadSchema.extend({
  integrity: z.object({
    algorithm: z.literal(PLAYER_PROGRESS_SIGNATURE_ALGORITHM),
    signature: z.string().min(1)
  })
});

export type PlayerProgressDocumentInput = z.infer<typeof playerProgressDocumentSchema>;
