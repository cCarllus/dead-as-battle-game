// Responsável por rastrear entrada local de locomoção com suporte a sprint, crouch e fly descend.
export type MovementInputState = {
  forward: boolean;
  left: boolean;
  backward: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  descend: boolean;
};

export type MovementInputSystem = {
  setEnabled: (enabled: boolean) => void;
  getState: () => MovementInputState;
  dispose: () => void;
};

const KEY_TO_DIRECTION: Record<string, keyof MovementInputState> = {
  KeyW: "forward",
  KeyA: "left",
  KeyS: "backward",
  KeyD: "right",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyC: "crouch",
  KeyQ: "descend"
};

function createInitialState(): MovementInputState {
  return {
    forward: false,
    left: false,
    backward: false,
    right: false,
    jump: false,
    sprint: false,
    crouch: false,
    descend: false
  };
}

function cloneState(state: MovementInputState): MovementInputState {
  return {
    forward: state.forward,
    left: state.left,
    backward: state.backward,
    right: state.right,
    jump: state.jump,
    sprint: state.sprint,
    crouch: state.crouch,
    descend: state.descend
  };
}

export function createMovementInputSystem(): MovementInputSystem {
  let enabled = true;
  let state = createInitialState();

  const clearState = (): void => {
    state = createInitialState();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const direction = KEY_TO_DIRECTION[event.code];
    if (!direction || !enabled) {
      return;
    }

    if (event.repeat) {
      event.preventDefault();
      return;
    }

    state = {
      ...state,
      [direction]: true
    };

    event.preventDefault();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const direction = KEY_TO_DIRECTION[event.code];
    if (!direction) {
      return;
    }

    state = {
      ...state,
      [direction]: false
    };

    if (enabled) {
      event.preventDefault();
    }
  };

  const onWindowBlur = (): void => {
    clearState();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);

  return {
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      if (!enabled) {
        clearState();
      }
    },
    getState: () => cloneState(state),
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      clearState();
    }
  };
}
