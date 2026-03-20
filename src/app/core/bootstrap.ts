// Responsável por compor dependências da aplicação e inicializar o ciclo de vida principal.
import "../styles/ui.css";
import { createAppController } from "../controllers/app.controller";
import { createJsonProgressStorage } from "@/persistence/storage/json-progress.storage";
import { createPlayerProgressRepository } from "@/persistence/repositories/player-progress.repository";
import { getChampionCatalogForUser } from "@/shared/champions/champions.catalog";
import type { ChampionId } from "@/shared/champions/champion.model";
import { warmUpAssetCache } from "./cache";
import { createAppState } from "./state";
import { createSessionService } from "./storage";
import { createUserService } from "../services/user.service";
import { createMenuAudioManager } from "../services/menu-audio-manager";
import { createSettingsService } from "../services/settings.service";
import { createPlayerProgressService } from "../services/player-progress.service";
import { createChatService } from "@/services/chat.service";
import { createTeamService } from "@/services/team.service";
import { getSelectedChampionForUser } from "../services/champion.service";
import { createNotificationService } from "../services/notification.service";
import { createRewardService } from "../services/reward.service";
import { createHeroPurchaseService } from "../services/hero-purchase.service";
import { createHeroSelectionService } from "../services/hero-selection.service";
import { createMatchService } from "@/services/match.service";
import { createMatchPresenceService } from "@/services/match-presence.service";

export type AppBootstrapHandle = {
  dispose: () => void;
};

export function bootstrap(): AppBootstrapHandle {
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;
  if (!uiRoot) {
    throw new Error("Elemento principal de UI não encontrado.");
  }

  const multiplayerEndpoint =
    import.meta.env.VITE_COLYSEUS_ENDPOINT ?? import.meta.env.VITE_SERVER_URL ?? "http://localhost:2567";

  const progressStorage = createJsonProgressStorage();
  const progressRepository = createPlayerProgressRepository({
    storage: progressStorage,
    legacyStorage: localStorage
  });

  const userService = createUserService({ repository: progressRepository });
  const settingsService = createSettingsService({ repository: progressRepository });
  const playerProgressService = createPlayerProgressService({
    repository: progressRepository,
    storage: progressStorage
  });
  const notificationService = createNotificationService({ userService });
  const rewardService = createRewardService({ userService, notificationService });
  const heroPurchaseService = createHeroPurchaseService({
    userService,
    notificationService
  });
  const heroSelectionService = createHeroSelectionService({ userService });
  const sessionService = createSessionService();
  const initialSettings = settingsService.load();
  document.documentElement.lang = initialSettings.locale;
  const appState = createAppState({ locale: initialSettings.locale });
  const audioCatalog = getChampionCatalogForUser("Player");
  const menuAudioManager = createMenuAudioManager({
    championThemeById: audioCatalog.reduce((acc, champion) => {
      acc[champion.id] = champion.selectAudioUrl;
      return acc;
    }, {} as Record<ChampionId, string>)
  });
  menuAudioManager.applySettings(initialSettings);

  const resolveNetworkIdentity = () => {
    const snapshot = sessionService.getSnapshot();
    const localUser = userService.getCurrentUser();
    let championName = "Unknown";
    let championLevel = 1;

    if (localUser) {
      const selectedChampion = getSelectedChampionForUser(localUser);
      championName = selectedChampion.displayName;
      championLevel = localUser.champions[selectedChampion.id].level;
    }

    if (snapshot) {
      return {
        userId: snapshot.userId,
        nickname: snapshot.nickname,
        championName,
        championLevel
      };
    }

    if (!localUser) {
      return null;
    }

    return {
      userId: localUser.id,
      nickname: localUser.nickname,
      championName,
      championLevel
    };
  };

  const resolveMatchIdentity = () => {
    const snapshot = sessionService.getSnapshot();
    const localUser = heroSelectionService.ensureSelectedHeroUnlocked() ?? userService.getCurrentUser();
    if (!localUser) {
      return null;
    }

    const selectedHeroId = heroSelectionService.resolveSafeSelectedHeroId(localUser);

    return {
      userId: snapshot?.userId ?? localUser.id,
      nickname: snapshot?.nickname ?? localUser.nickname,
      heroId: selectedHeroId,
      heroLevel: localUser.champions[selectedHeroId]?.level ?? 1
    };
  };

  const chatService = createChatService({
    endpoint: multiplayerEndpoint,
    getIdentity: resolveNetworkIdentity
  });

  const teamService = createTeamService({
    endpoint: multiplayerEndpoint,
    getIdentity: resolveNetworkIdentity
  });

  const matchService = createMatchService({
    endpoint: multiplayerEndpoint,
    getIdentity: resolveMatchIdentity
  });
  const matchPresenceService = createMatchPresenceService({
    endpoint: multiplayerEndpoint,
    roomName: "global_match"
  });

  const appController = createAppController({
    uiRoot,
    state: appState,
    userService,
    playerProgressService,
    sessionService,
    menuAudioManager,
    settingsService,
    chatService,
    teamService,
    notificationService,
    rewardService,
    heroPurchaseService,
    heroSelectionService,
    matchService,
    matchPresenceService,
    warmUpAssets: warmUpAssetCache
  });

  appController.start();

  const handleBeforeUnload = (): void => {
    appController.dispose();
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return {
    dispose: () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      appController.dispose();
    }
  };
}
