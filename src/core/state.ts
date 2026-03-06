// Responsável por armazenar e atualizar estado global simples da aplicação.
import { resolveLocale, type Locale } from "../i18n";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../ui/navigation/menu.model";

export type ScreenId = "loading" | "nickname" | "home" | "champions" | "notes" | "settings";

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

function createDefaultState(): AppState {
  return {
    currentScreen: "loading",
    locale: resolveLocale(document.documentElement.lang),
    activeMenuTab: DEFAULT_ACTIVE_TAB
  };
}

export function createAppState(initialState: Partial<AppState> = {}): AppStateStore {
  let state: AppState = { ...createDefaultState(), ...initialState };

  return {
    get: () => state,
    set: (nextState) => {
      state = nextState;
    },
    patch: (partial) => {
      state = { ...state, ...partial };
    }
  };
}
