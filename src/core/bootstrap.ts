// Responsável por compor dependências da aplicação e inicializar o ciclo de vida principal.
import "../ui/styles/ui.css";
import { createAppController } from "../controllers/app.controller";
import { getChampionCatalogForUser } from "../data/champions.catalog";
import type { ChampionId } from "../models/champion.model";
import { warmUpAssetCache } from "./cache";
import { createAppState } from "./state";
import { createSessionService } from "./storage";
import { createUserRepository } from "../repositories/user.repository";
import { createUserService } from "../services/user.service";
import { createAudioService } from "../services/audio.service";
import { createSettingsService } from "../services/settings.service";
import { createChatService } from "../services/chat.service";
import { createTeamService } from "../services/team.service";
import { getSelectedChampionForUser } from "../services/champion.service";
import { createNotificationService } from "../services/notification.service";
import { createRewardService } from "../services/reward.service";
import { createHeroPurchaseService } from "../services/hero-purchase.service";
import { createHeroSelectionService } from "../services/hero-selection.service";

export function bootstrap(): void {
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;
  if (!uiRoot) {
    throw new Error("Elemento principal de UI não encontrado.");
  }

  const userService = createUserService({ repository: createUserRepository() });
  const notificationService = createNotificationService({ userService });
  const rewardService = createRewardService({ userService, notificationService });
  const heroPurchaseService = createHeroPurchaseService({
    userService,
    notificationService
  });
  const heroSelectionService = createHeroSelectionService({ userService });
  const sessionService = createSessionService();
  const settingsService = createSettingsService();
  const initialSettings = settingsService.load();
  document.documentElement.lang = initialSettings.locale;
  const appState = createAppState({ locale: initialSettings.locale });
  const audioCatalog = getChampionCatalogForUser("Player");
  const audioService = createAudioService({
    selectAudioByChampionId: audioCatalog.reduce((acc, champion) => {
      acc[champion.id] = champion.selectAudioUrl;
      return acc;
    }, {} as Record<ChampionId, string>)
  });
  audioService.applySettings(initialSettings);

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

  const chatService = createChatService({
    endpoint: import.meta.env.VITE_COLYSEUS_ENDPOINT,
    getIdentity: resolveNetworkIdentity
  });

  const teamService = createTeamService({
    endpoint: import.meta.env.VITE_COLYSEUS_ENDPOINT,
    getIdentity: resolveNetworkIdentity
  });

  const appController = createAppController({
    uiRoot,
    state: appState,
    userService,
    sessionService,
    audioService,
    settingsService,
    chatService,
    teamService,
    notificationService,
    rewardService,
    heroPurchaseService,
    heroSelectionService,
    warmUpAssets: warmUpAssetCache
  });

  appController.start();

  window.addEventListener("beforeunload", () => {
    appController.dispose();
  });
}
