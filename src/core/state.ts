import { resolveLocale, type Locale } from "../i18n";
import type { CharacterId } from "../game/entities/player/player.types";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../ui/screens/mainMenu.model";

export type ScreenId = "mainMenu" | "characterSelect" | "settings" | "lobby" | "arena" | "exit";

export type AppState = {
  currentScreen: ScreenId;
  selectedCharacter: CharacterId;
  locale: Locale;
  activeMenuTab: MenuTabId;
};

export type AppStateStore = {
  get: () => AppState;
  set: (nextState: AppState) => void;
  patch: (partial: Partial<AppState>) => void;
};

export function createAppState(initialState: Partial<AppState> = {}): AppStateStore {
  let state: AppState = {
    currentScreen: "mainMenu",
    selectedCharacter: "ryomen_sukuna",
    locale: resolveLocale(document.documentElement.lang),
    activeMenuTab: DEFAULT_ACTIVE_TAB,
    ...initialState
  };

  return {
    get: () => state,
    set: (nextState: AppState) => {
      state = nextState;
    },
    patch: (partial: Partial<AppState>) => {
      state = { ...state, ...partial };
    }
  };
}
