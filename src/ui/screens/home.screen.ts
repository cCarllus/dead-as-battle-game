// Responsável por compor renderização e interações da tela Home.
import template from "../layout/home.html?raw";
import type { Locale } from "../../i18n";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../navigation/menu.model";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";
import { bindHomeEvents } from "./home.events";
import { renderHomeView } from "./home.view";
import type { MenuActionId } from "./home.model";
import { mountSettingsModal } from "../components/settings-modal";
import { mountExitConfirmModal } from "../components/exit-confirm-modal";
import type { GameSettings, SettingsService } from "../../services/settings.service";

export type HomeActions = {
  onOpenMultiplayer: () => void;
  onOpenChampions: () => void;
  onExit: () => void;
  onClearSession: () => void;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  settingsService: SettingsService;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  selectedChampionModelUrl: string | null;
  selectedChampionSplashImageUrl: string;
  selectedChampionThemeColor: string;
  isUserChampion: boolean;
  isSessionActive: boolean;
};

function createActionHandlers(
  actions: HomeActions,
  openSettingsModal: () => void,
  openExitConfirmModal: () => void
): Record<MenuActionId, () => void> {
  return {
    play: actions.onOpenMultiplayer,
    champions: actions.onOpenChampions,
    settings: openSettingsModal,
    exit: openExitConfirmModal
  };
}

export function renderHomeScreen(root: HTMLElement, actions: HomeActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const activeTab = actions.activeTab ?? DEFAULT_ACTIVE_TAB;
  const menu = renderScreenTemplate(root, template, '[data-screen="home"]', locale);

  const homeView = renderHomeView({
    root,
    locale,
    activeTab,
    playerName: actions.playerName,
    selectedChampionName: actions.selectedChampionName,
    selectedChampionLevel: actions.selectedChampionLevel,
    selectedChampionModelUrl: actions.selectedChampionModelUrl,
    selectedChampionSplashImageUrl: actions.selectedChampionSplashImageUrl,
    selectedChampionThemeColor: actions.selectedChampionThemeColor,
    isUserChampion: actions.isUserChampion,
    isSessionActive: actions.isSessionActive
  });

  const settingsModal = mountSettingsModal({
    locale,
    menu: homeView.menu,
    settingsService: actions.settingsService,
    onApplyAudioSettings: actions.onApplyAudioSettings,
    onApplyLocale: actions.onApplyLocale,
    onClearSession: actions.onClearSession
  });

  const exitConfirmModal = mountExitConfirmModal({
    menu: homeView.menu,
    onConfirmExit: actions.onExit
  });

  const actionHandlers = createActionHandlers(actions, settingsModal.open, exitConfirmModal.open);

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (homeView.menu.classList.contains("is-settings-open")) {
      return;
    }

    if (exitConfirmModal.isOpen()) {
      return;
    }

    event.preventDefault();
    exitConfirmModal.open();
  };

  window.addEventListener("keydown", onWindowKeyDown);

  const disposeEvents = bindHomeEvents({
    menu,
    initialActiveTab: activeTab,
    onTabChange: (tab) => {
      actions.onNavigateTab?.(tab);
    },
    onAction: (actionId) => {
      actionHandlers[actionId]();
    }
  });

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
    disposeEvents();
    settingsModal.dispose();
    exitConfirmModal.dispose();
    homeView.dispose();
  };
}
