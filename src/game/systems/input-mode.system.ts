// Responsável por coordenar o modo de entrada (gameplay vs UI) com base em pausa/settings/disponibilidade de gameplay.

export type InputMode = "gameplay" | "ui";

export type InputModeState = {
  mode: InputMode;
  gameplayAvailable: boolean;
  pauseMenuOpen: boolean;
  settingsOpen: boolean;
  gameplayEnabled: boolean;
};

export type InputModeSystem = {
  getState: () => InputModeState;
  setGameplayAvailable: (available: boolean) => void;
  setPauseMenuOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  onStateChanged: (listener: (state: InputModeState) => void) => () => void;
  dispose: () => void;
};

export type CreateInputModeSystemOptions = {
  gameplayAvailable?: boolean;
  pauseMenuOpen?: boolean;
  settingsOpen?: boolean;
};

function resolveState(
  gameplayAvailable: boolean,
  pauseMenuOpen: boolean,
  settingsOpen: boolean
): InputModeState {
  const gameplayEnabled = gameplayAvailable && !pauseMenuOpen && !settingsOpen;

  return {
    mode: gameplayEnabled ? "gameplay" : "ui",
    gameplayAvailable,
    pauseMenuOpen,
    settingsOpen,
    gameplayEnabled
  };
}

export function createInputModeSystem(options: CreateInputModeSystemOptions = {}): InputModeSystem {
  let gameplayAvailable = options.gameplayAvailable ?? false;
  let pauseMenuOpen = options.pauseMenuOpen ?? false;
  let settingsOpen = options.settingsOpen ?? false;

  let state = resolveState(gameplayAvailable, pauseMenuOpen, settingsOpen);
  const listeners = new Set<(state: InputModeState) => void>();

  const apply = (): void => {
    const nextState = resolveState(gameplayAvailable, pauseMenuOpen, settingsOpen);
    const changed =
      nextState.mode !== state.mode ||
      nextState.gameplayAvailable !== state.gameplayAvailable ||
      nextState.pauseMenuOpen !== state.pauseMenuOpen ||
      nextState.settingsOpen !== state.settingsOpen ||
      nextState.gameplayEnabled !== state.gameplayEnabled;

    if (!changed) {
      return;
    }

    state = nextState;
    listeners.forEach((listener) => {
      listener(state);
    });
  };

  return {
    getState: () => ({ ...state }),
    setGameplayAvailable: (available) => {
      gameplayAvailable = available;
      apply();
    },
    setPauseMenuOpen: (open) => {
      pauseMenuOpen = open;
      apply();
    },
    setSettingsOpen: (open) => {
      settingsOpen = open;
      apply();
    },
    onStateChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      listeners.clear();
    }
  };
}
