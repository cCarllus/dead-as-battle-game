// Responsável por persistir e normalizar configurações de jogo no localStorage.
import type { Locale } from "../i18n";

export type GameSettings = {
  locale: Locale;
  fullscreen: boolean;
  muteAll: boolean;
  masterVolume: number;
  cameraFovPercent: number;
  renderDistanceViewPercent: number;
};

export type SettingsStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SettingsService = {
  load: () => GameSettings;
  save: (settings: GameSettings) => GameSettings;
  reset: () => GameSettings;
  clear: () => void;
};

export const SETTINGS_STORAGE_KEY = "dab:settings";

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettings> = Object.freeze({
  locale: "pt-BR",
  fullscreen: false,
  muteAll: false,
  masterVolume: 80,
  cameraFovPercent: 50,
  renderDistanceViewPercent: 50
});

function clampVolume(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  if (normalized < 0) {
    return 0;
  }

  if (normalized > 100) {
    return 100;
  }

  return normalized;
}

function clampPercentRange(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  if (normalized < 1) {
    return 1;
  }

  if (normalized > 100) {
    return 100;
  }

  return normalized;
}

function parseSettings(rawValue: string): unknown | null {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

function cloneSettings(settings: Readonly<GameSettings>): GameSettings {
  return {
    locale: settings.locale,
    fullscreen: settings.fullscreen,
    muteAll: settings.muteAll,
    masterVolume: settings.masterVolume,
    cameraFovPercent: settings.cameraFovPercent,
    renderDistanceViewPercent: settings.renderDistanceViewPercent
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeLocale(value: unknown): Locale {
  return value === "en-US" ? "en-US" : "pt-BR";
}

export function normalizeGameSettings(value: unknown): GameSettings {
  if (!isRecord(value)) {
    return cloneSettings(DEFAULT_GAME_SETTINGS);
  }

  return {
    locale: normalizeLocale(value.locale),
    fullscreen: value.fullscreen === true,
    muteAll: value.muteAll === true,
    masterVolume: clampVolume(
      typeof value.masterVolume === "number" ? value.masterVolume : Number.NaN,
      DEFAULT_GAME_SETTINGS.masterVolume
    ),
    cameraFovPercent: clampPercentRange(
      typeof value.cameraFovPercent === "number" ? value.cameraFovPercent : Number.NaN,
      DEFAULT_GAME_SETTINGS.cameraFovPercent
    ),
    renderDistanceViewPercent: clampPercentRange(
      typeof value.renderDistanceViewPercent === "number"
        ? value.renderDistanceViewPercent
        : Number.NaN,
      DEFAULT_GAME_SETTINGS.renderDistanceViewPercent
    )
  };
}

export function createSettingsService(
  storage: SettingsStorageAdapter = localStorage,
  storageKey: string = SETTINGS_STORAGE_KEY
): SettingsService {
  const load = (): GameSettings => {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return cloneSettings(DEFAULT_GAME_SETTINGS);
    }

    return normalizeGameSettings(parseSettings(rawValue));
  };

  const save = (settings: GameSettings): GameSettings => {
    const normalized = normalizeGameSettings(settings);
    storage.setItem(storageKey, JSON.stringify(normalized));
    return normalized;
  };

  const reset = (): GameSettings => {
    const defaults = cloneSettings(DEFAULT_GAME_SETTINGS);
    storage.setItem(storageKey, JSON.stringify(defaults));
    return defaults;
  };

  const clear = (): void => {
    storage.removeItem(storageKey);
  };

  return {
    load,
    save,
    reset,
    clear
  };
}
