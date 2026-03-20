// Responsável por exportar/importar progresso do jogador sem expor JSON bruto à UI.
import { APP_VERSION_LABEL } from "@/config/version";
import type { GameSettings } from "@/config/game-settings";
import type { ChampionId } from "@/shared/champions/champion.model";
import type { UserProfile } from "@/shared/user/user.model";
import type { PlayerProgressRepository } from "@/persistence/repositories/player-progress.repository";
import { createPlayerProgressRepository } from "@/persistence/repositories/player-progress.repository";
import { attachProgressSignature } from "@/persistence/security/progress-signature";
import { validatePlayerProgressDocument } from "@/persistence/security/progress-validator";
import type { JsonProgressStorage } from "@/persistence/storage/json-progress.storage";
import { createJsonProgressStorage } from "@/persistence/storage/json-progress.storage";
import {
  PLAYER_PROGRESS_SAVE_VERSION,
  championProgressToPersisted,
  type PlayerProgressDocument,
  type PlayerProgressImportPreview,
  type PlayerProgressPayload
} from "@/persistence/types/player-progress.types";

type PendingImport = {
  user: UserProfile;
  settings: GameSettings;
  preview: PlayerProgressImportPreview;
};

export type PlayerProgressExportFile = {
  fileName: string;
  content: string;
  preview: PlayerProgressImportPreview;
};

export type PlayerProgressServiceResult<T> =
  | {
      ok: true;
      value: T;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      warnings: string[];
    };

export type PlayerProgressService = {
  exportProgress: () => PlayerProgressServiceResult<PlayerProgressExportFile>;
  prepareImport: (file: File) => Promise<PlayerProgressServiceResult<PlayerProgressImportPreview>>;
  commitImport: () => PlayerProgressServiceResult<UserProfile>;
  clearPendingImport: () => void;
};

export type PlayerProgressServiceDependencies = {
  repository: PlayerProgressRepository;
  storage: JsonProgressStorage;
};

function buildPayload(user: UserProfile, settings: GameSettings): PlayerProgressPayload {
  return {
    saveVersion: PLAYER_PROGRESS_SAVE_VERSION,
    gameVersion: APP_VERSION_LABEL,
    playerId: user.id,
    profile: {
      nickname: user.nickname,
      createdAt: user.createdAt,
      coins: user.coins,
      activePlayTimeSeconds: user.activePlayTimeSeconds,
      pendingCoinRewards: user.pendingCoinRewards,
      notifications: user.notifications
    },
    champions: Object.entries(user.champions)
      .map(([championId, progress]) => championProgressToPersisted(championId as ChampionId, progress))
      .sort((left, right) => left.championId.localeCompare(right.championId)),
    selectedChampionId: user.selectedChampionId,
    settings,
    metadata: {
      createdAt: user.createdAt,
      updatedAt: new Date().toISOString()
    }
  };
}

function buildPreview(document: PlayerProgressDocument): PlayerProgressImportPreview {
  return {
    playerId: document.playerId,
    nickname: document.profile.nickname,
    selectedChampionId: document.selectedChampionId,
    championCount: document.champions.length,
    coins: document.profile.coins,
    locale: document.settings.locale,
    updatedAt: document.metadata.updatedAt,
    warnings: []
  };
}

export function createPlayerProgressService({
  repository,
  storage
}: PlayerProgressServiceDependencies = {
  repository: createPlayerProgressRepository(),
  storage: createJsonProgressStorage()
}): PlayerProgressService {
  let pendingImport: PendingImport | null = null;

  return {
    exportProgress: () => {
      const user = repository.loadProfile();
      if (!user) {
        return {
          ok: false,
          error: "No local player profile is available to export.",
          warnings: []
        };
      }

      const document = attachProgressSignature(buildPayload(user, repository.loadSettings()));
      const safeNickname = user.nickname.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "player";

      return {
        ok: true,
        value: {
          fileName: `dab-progress-${safeNickname}.json`,
          content: storage.serializeDocument(document),
          preview: buildPreview(document)
        },
        warnings: []
      };
    },
    prepareImport: async (file) => {
      try {
        const parsedFile = await storage.readImportFile(file);
        const validation = validatePlayerProgressDocument(parsedFile);
        if (!validation.ok) {
          pendingImport = null;
          return {
            ok: false,
            error: validation.errors.join(" "),
            warnings: validation.warnings
          };
        }

        pendingImport = {
          user: validation.user,
          settings: validation.document.settings,
          preview: validation.preview
        };

        return {
          ok: true,
          value: validation.preview,
          warnings: validation.warnings
        };
      } catch (error) {
        pendingImport = null;
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to read the selected save file.",
          warnings: []
        };
      }
    },
    commitImport: () => {
      if (!pendingImport) {
        return {
          ok: false,
          error: "No validated progress file is pending import.",
          warnings: []
        };
      }

      repository.saveState({
        profile: pendingImport.user,
        settings: pendingImport.settings,
        metadata: {
          createdAt: pendingImport.user.createdAt,
          updatedAt: new Date().toISOString()
        }
      });

      const importedUser = pendingImport.user;
      const warnings = pendingImport.preview.warnings;
      pendingImport = null;

      return {
        ok: true,
        value: importedUser,
        warnings
      };
    },
    clearPendingImport: () => {
      pendingImport = null;
    }
  };
}
