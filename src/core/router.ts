import type { Engine } from "@babylonjs/core";
import type { AppStateStore, ScreenId } from "./state";

export type ScreenContext = {
  engine: Engine;
  canvas: HTMLCanvasElement;
  uiRoot: HTMLDivElement;
  state: AppStateStore;
  goTo: (screen: ScreenId) => void;
};

export type ScreenHandler = (context: ScreenContext) => void | (() => void);

export type ScreenRegistry = Record<ScreenId, ScreenHandler>;

export function createRouter(
  baseContext: Omit<ScreenContext, "goTo">,
  screens: ScreenRegistry
): { goTo: (screen: ScreenId) => void; dispose: () => void } {
  let activeCleanup: (() => void) | null = null;

  const goTo = (screen: ScreenId): void => {
    activeCleanup?.();
    activeCleanup = null;

    baseContext.state.patch({ currentScreen: screen });
    const cleanup = screens[screen]({ ...baseContext, goTo });

    if (cleanup) {
      activeCleanup = cleanup;
    }
  };

  return {
    goTo,
    dispose: () => {
      activeCleanup?.();
      activeCleanup = null;
    }
  };
}
