import { resolveLocale, type Locale } from "../i18n";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../ui/screens/mainMenu.model";

export type ScreenId =
  | "loading"
  | "nickname"
  | "mainMenu"
  | "settings";

export type AppState = {
  currentScreen: ScreenId;
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
    currentScreen: "loading",
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
