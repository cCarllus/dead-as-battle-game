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

export function bootstrap(): void {
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;
  if (!uiRoot) {
    throw new Error("Elemento principal de UI não encontrado.");
  }

  const userService = createUserService({ repository: createUserRepository() });
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

  const appController = createAppController({
    uiRoot,
    state: appState,
    userService,
    sessionService,
    audioService,
    settingsService,
    warmUpAssets: warmUpAssetCache
  });

  appController.start();

  window.addEventListener("beforeunload", () => {
    appController.dispose();
  });
}
