// Responsável por expor configurações do jogo via repositório central de progresso.
import {
  DEFAULT_GAME_SETTINGS,
  cloneGameSettings,
  normalizeGameSettings,
  type GameSettings
} from "@/config/game-settings";
import type { PlayerProgressRepository } from "@/persistence/repositories/player-progress.repository";
import { createPlayerProgressRepository } from "@/persistence/repositories/player-progress.repository";

export type SettingsService = {
  load: () => GameSettings;
  save: (settings: GameSettings) => GameSettings;
  reset: () => GameSettings;
  clear: () => void;
};

export type SettingsServiceDependencies = {
  repository: PlayerProgressRepository;
};

export function createSettingsService({
  repository
}: SettingsServiceDependencies = {
  repository: createPlayerProgressRepository()
}): SettingsService {
  return {
    load: () => repository.loadSettings(),
    save: (settings) => repository.saveSettings(normalizeGameSettings(settings)),
    reset: () => repository.saveSettings(cloneGameSettings(DEFAULT_GAME_SETTINGS)),
    clear: () => {
      repository.saveSettings(cloneGameSettings(DEFAULT_GAME_SETTINGS));
    }
  };
}

export { DEFAULT_GAME_SETTINGS, normalizeGameSettings, type GameSettings } from "@/config/game-settings";
