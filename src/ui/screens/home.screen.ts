// Responsável por compor renderização e interações da tela Home.
import template from "../layout/home.html?raw";
import type { Locale } from "../../i18n";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../navigation/menu.model";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";
import { bindHomeEvents } from "./home.events";
import { renderHomeView } from "./home.view";
import type { MenuActionId } from "./home.model";

export type HomeActions = {
  onOpenConfig: () => void;
  onOpenMultiplayer: () => void;
  onExit: () => void;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  playerName: string;
  playerLevel: number;
  isSessionActive: boolean;
};

function createActionHandlers(actions: HomeActions): Record<MenuActionId, () => void> {
  return {
    play: actions.onOpenMultiplayer,
    settings: actions.onOpenConfig,
    exit: actions.onExit
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
    playerLevel: actions.playerLevel,
    isSessionActive: actions.isSessionActive
  });

  const actionHandlers = createActionHandlers(actions);

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
    disposeEvents();
    homeView.dispose();
  };
}
