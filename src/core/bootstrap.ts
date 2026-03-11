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
import { createMenuAudioManager } from "../services/menu-audio-manager";
import { createSettingsService } from "../services/settings.service";
import { createChatService } from "../services/chat.service";
import { createTeamService } from "../services/team.service";
import { getSelectedChampionForUser } from "../services/champion.service";
import { createNotificationService } from "../services/notification.service";
import { createRewardService } from "../services/reward.service";
import { createHeroPurchaseService } from "../services/hero-purchase.service";
import { createHeroSelectionService } from "../services/hero-selection.service";
import { createMatchService } from "../services/match.service";
import { createMatchPresenceService } from "../services/match-presence.service";

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
    endpoint: import.meta.env.VITE_COLYSEUS_ENDPOINT,
    getIdentity: resolveNetworkIdentity
  });

  const teamService = createTeamService({
    endpoint: import.meta.env.VITE_COLYSEUS_ENDPOINT,
    getIdentity: resolveNetworkIdentity
  });

  const matchService = createMatchService({
    endpoint: import.meta.env.VITE_COLYSEUS_ENDPOINT,
    getIdentity: resolveMatchIdentity
  });
  const matchPresenceService = createMatchPresenceService({
    endpoint: import.meta.env.VITE_COLYSEUS_ENDPOINT,
    roomName: "global_match"
  });

  const appController = createAppController({
    uiRoot,
    state: appState,
    userService,
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

  window.addEventListener("beforeunload", () => {
    appController.dispose();
  });
}
