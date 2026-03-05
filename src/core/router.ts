// Responsável por controlar navegação entre telas e ciclo de vida de cleanups de UI.
import type { AppStateStore, ScreenId } from "./state";

export type ScreenContext = {
  uiRoot: HTMLDivElement;
  state: AppStateStore;
  goTo: (screen: ScreenId) => void;
};

export type ScreenHandler = (context: ScreenContext) => void | (() => void);

export type ScreenRegistry = Record<ScreenId, ScreenHandler>;

export type AppRouter = {
  goTo: (screen: ScreenId) => void;
  dispose: () => void;
};

export function createRouter(baseContext: Omit<ScreenContext, "goTo">, screens: ScreenRegistry): AppRouter {
  let disposeCurrentScreen: (() => void) | null = null;

  const goTo = (screen: ScreenId): void => {
    disposeCurrentScreen?.();
    disposeCurrentScreen = null;

    baseContext.state.patch({ currentScreen: screen });
    const cleanup = screens[screen]({ ...baseContext, goTo });

    if (cleanup) {
      disposeCurrentScreen = cleanup;
    }
  };

  return {
    goTo,
    dispose: () => {
      disposeCurrentScreen?.();
      disposeCurrentScreen = null;
    }
  };
}
