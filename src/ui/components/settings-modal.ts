// Responsável por controlar interação, persistência e acessibilidade do modal de configurações da Home.
import type { Locale } from "../../i18n";
import { resolveLocale, t } from "../../i18n";
import { applyFullscreenPreference, isFullscreenSupported } from "../../game/systems/fullscreen.system";
import type { GameSettings, SettingsService } from "../../services/settings.service";
import { DEFAULT_GAME_SETTINGS } from "../../services/settings.service";
import { bind, qs } from "./dom";

const STORAGE_CLEAR_PREFIXES = ["dab:", "dab."] as const;
const MODAL_HIDE_TRANSITION_MS = 220;
const SAVE_TOAST_TIMEOUT_MS = 2200;

export type SettingsModalController = {
  open: () => void;
  dispose: () => void;
};

export type MountSettingsModalOptions = {
  locale?: Locale;
  menu: HTMLElement;
  settingsService: SettingsService;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplySettings?: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  onClearSession: () => void;
};

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

function readVolumeInput(input: HTMLInputElement): number {
  const parsed = Number(input.value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function updateSliderFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);

  const denominator = max - min;
  const ratio = denominator > 0 ? (value - min) / denominator : 0;
  const percentage = Math.min(100, Math.max(0, ratio * 100));
  input.style.setProperty("--slider-fill", `${percentage}%`);
}

function clearStorageByPrefixes(storage: Storage, prefixes: readonly string[]): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }

    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

export function mountSettingsModal({
  locale,
  menu,
  settingsService,
  onApplyAudioSettings,
  onApplySettings,
  onApplyLocale,
  onClearSession
}: MountSettingsModalOptions): SettingsModalController {
  const resolvedLocale = resolveLocale(locale ?? document.documentElement.lang);

  const modal = qs<HTMLElement>(menu, '[data-slot="settings-modal"]');
  const panel = qs<HTMLElement>(menu, '[data-slot="settings-panel"]');
  const toast = qs<HTMLElement>(menu, '[data-slot="settings-toast"]');
  const unsupportedHint = qs<HTMLElement>(menu, '[data-slot="settings-fullscreen-unsupported"]');

  const fullscreenField = qs<HTMLElement>(menu, '[data-setting-field="fullscreen"]');
  const cameraFovField = qs<HTMLElement>(menu, '[data-setting-field="cameraFovPercent"]');
  const renderDistanceViewField = qs<HTMLElement>(menu, '[data-setting-field="renderDistanceViewPercent"]');
  const masterVolumeField = qs<HTMLElement>(menu, '[data-setting-field="masterVolume"]');

  const fullscreenToggle = qs<HTMLInputElement>(menu, 'input[data-setting-toggle="fullscreen"]');
  const muteAllToggle = qs<HTMLInputElement>(menu, 'input[data-setting-toggle="muteAll"]');

  const masterVolumeInput = qs<HTMLInputElement>(menu, 'input[data-setting-slider="masterVolume"]');
  const cameraFovInput = qs<HTMLInputElement>(menu, 'input[data-setting-slider="cameraFovPercent"]');
  const renderDistanceViewInput = qs<HTMLInputElement>(
    menu,
    'input[data-setting-slider="renderDistanceViewPercent"]'
  );
  const localeSelect = qs<HTMLSelectElement>(menu, 'select[data-setting-select="locale"]');

  const masterVolumeValue = qs<HTMLElement>(menu, '[data-setting-value="masterVolume"]');
  const cameraFovValue = qs<HTMLElement>(menu, '[data-setting-value="cameraFovPercent"]');
  const renderDistanceViewValue = qs<HTMLElement>(menu, '[data-setting-value="renderDistanceViewPercent"]');

  const cancelButton = qs<HTMLButtonElement>(menu, 'button[data-settings-action="cancel"]');
  const saveButton = qs<HTMLButtonElement>(menu, 'button[data-settings-action="save"]');
  const restoreButton = qs<HTMLButtonElement>(menu, 'button[data-settings-action="restore"]');
  const logoutButton = qs<HTMLButtonElement>(menu, 'button[data-settings-action="logout"]');
  const overlayButton = qs<HTMLButtonElement>(menu, 'button[data-settings-action="overlay-close"]');

  const fullscreenAvailable = isFullscreenSupported();
  if (!fullscreenAvailable) {
    fullscreenToggle.disabled = true;
    fullscreenField.classList.add("is-disabled");
    unsupportedHint.hidden = false;
  }

  let savedSettings = cloneSettings(settingsService.load());
  let draftSettings = cloneSettings(savedSettings);
  let isOpen = false;
  let toastTimeoutId: number | null = null;
  let hideTimeoutId: number | null = null;

  const clearTimers = (): void => {
    if (toastTimeoutId !== null) {
      window.clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }

    if (hideTimeoutId !== null) {
      window.clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
  };

  const updateVolumeFieldState = (): void => {
    const disableMaster = draftSettings.muteAll;
    masterVolumeInput.disabled = disableMaster;
    masterVolumeField.classList.toggle("is-disabled", disableMaster);
  };

  const renderDraft = (): void => {
    if (fullscreenAvailable) {
      fullscreenToggle.checked = draftSettings.fullscreen;
    }

    muteAllToggle.checked = draftSettings.muteAll;
    localeSelect.value = draftSettings.locale;

    masterVolumeInput.value = String(draftSettings.masterVolume);
    cameraFovInput.value = String(draftSettings.cameraFovPercent);
    renderDistanceViewInput.value = String(draftSettings.renderDistanceViewPercent);

    updateSliderFill(masterVolumeInput);
    updateSliderFill(cameraFovInput);
    updateSliderFill(renderDistanceViewInput);

    masterVolumeValue.textContent = `${draftSettings.masterVolume}%`;
    cameraFovValue.textContent = `${draftSettings.cameraFovPercent}%`;
    renderDistanceViewValue.textContent = `${draftSettings.renderDistanceViewPercent}%`;

    updateVolumeFieldState();
    cameraFovField.classList.remove("is-disabled");
    renderDistanceViewField.classList.remove("is-disabled");
  };

  const showSavedToast = (): void => {
    toast.textContent = t(resolvedLocale, "settings.toast.saved");
    toast.classList.add("is-visible");

    if (toastTimeoutId !== null) {
      window.clearTimeout(toastTimeoutId);
    }

    toastTimeoutId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toastTimeoutId = null;
    }, SAVE_TOAST_TIMEOUT_MS);
  };

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeModal();
  };

  function openModal(): void {
    if (isOpen) {
      return;
    }

    if (hideTimeoutId !== null) {
      window.clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }

    draftSettings = cloneSettings(savedSettings);
    if (!fullscreenAvailable) {
      draftSettings.fullscreen = false;
    }

    renderDraft();

    isOpen = true;
    menu.classList.add("is-settings-open");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      modal.classList.add("is-open");
    });

    window.addEventListener("keydown", onWindowKeyDown);

    const preferredFocus = fullscreenAvailable ? fullscreenToggle : muteAllToggle;
    window.setTimeout(() => {
      preferredFocus.focus();
    }, 10);
  }

  function closeModal(): void {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    menu.classList.remove("is-settings-open");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    window.removeEventListener("keydown", onWindowKeyDown);

    if (hideTimeoutId !== null) {
      window.clearTimeout(hideTimeoutId);
    }

    hideTimeoutId = window.setTimeout(() => {
      if (isOpen) {
        return;
      }

      modal.hidden = true;
      hideTimeoutId = null;
    }, MODAL_HIDE_TRANSITION_MS);
  }

  const cleanups = [
    bind(cancelButton, "click", () => {
      closeModal();
    }),
    bind(overlayButton, "click", () => {
      closeModal();
    }),
    bind(saveButton, "click", () => {
      savedSettings = settingsService.save(draftSettings);
      draftSettings = cloneSettings(savedSettings);
      void applyFullscreenPreference(savedSettings.fullscreen);
      onApplyAudioSettings(savedSettings);
      onApplySettings?.(savedSettings);
      closeModal();
      const localeChanged = onApplyLocale(savedSettings.locale);

      if (!localeChanged) {
        showSavedToast();
      }
    }),
    bind(restoreButton, "click", () => {
      draftSettings = cloneSettings(DEFAULT_GAME_SETTINGS);
      if (!fullscreenAvailable) {
        draftSettings.fullscreen = false;
      }
      renderDraft();
    }),
    bind(logoutButton, "click", () => {
      const confirmed = window.confirm(t(resolvedLocale, "settings.account.logout.confirm"));
      if (!confirmed) {
        return;
      }

      clearStorageByPrefixes(localStorage, STORAGE_CLEAR_PREFIXES);
      clearStorageByPrefixes(sessionStorage, STORAGE_CLEAR_PREFIXES);
      settingsService.clear();
      const defaultSettings = cloneSettings(DEFAULT_GAME_SETTINGS);
      onApplyAudioSettings(defaultSettings);
      onApplySettings?.(defaultSettings);

      closeModal();
      onClearSession();
    }),
    bind(fullscreenToggle, "change", () => {
      draftSettings.fullscreen = fullscreenToggle.checked;
    }),
    bind(muteAllToggle, "change", () => {
      draftSettings.muteAll = muteAllToggle.checked;
      renderDraft();
    }),
    bind(localeSelect, "change", () => {
      draftSettings.locale = resolveLocale(localeSelect.value);
      renderDraft();
    }),
    bind(masterVolumeInput, "input", () => {
      draftSettings.masterVolume = readVolumeInput(masterVolumeInput);
      renderDraft();
    }),
    bind(cameraFovInput, "input", () => {
      draftSettings.cameraFovPercent = Math.max(1, Math.min(100, Math.round(Number(cameraFovInput.value))));
      renderDraft();
    }),
    bind(renderDistanceViewInput, "input", () => {
      draftSettings.renderDistanceViewPercent = Math.max(
        1,
        Math.min(100, Math.round(Number(renderDistanceViewInput.value)))
      );
      renderDraft();
    }),
    bind(panel, "click", (event) => {
      event.stopPropagation();
    })
  ];

  renderDraft();

  return {
    open: openModal,
    dispose: () => {
      clearTimers();
      window.removeEventListener("keydown", onWindowKeyDown);
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    }
  };
}
