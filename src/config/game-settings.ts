import type { Locale } from "@/app/i18n";

export type GameSettings = {
  locale: Locale;
  fullscreen: boolean;
  muteAll: boolean;
  masterVolume: number;
  cameraFovPercent: number;
  renderDistanceViewPercent: number;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeLocale(value: unknown): Locale {
  return value === "en-US" ? "en-US" : "pt-BR";
}

export function cloneGameSettings(settings: Readonly<GameSettings>): GameSettings {
  return {
    locale: settings.locale,
    fullscreen: settings.fullscreen,
    muteAll: settings.muteAll,
    masterVolume: settings.masterVolume,
    cameraFovPercent: settings.cameraFovPercent,
    renderDistanceViewPercent: settings.renderDistanceViewPercent
  };
}

export function normalizeGameSettings(value: unknown): GameSettings {
  if (!isRecord(value)) {
    return cloneGameSettings(DEFAULT_GAME_SETTINGS);
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
