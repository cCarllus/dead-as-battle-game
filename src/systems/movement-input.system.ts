// Responsável por rastrear entrada local de locomoção com crouch por hold no Ctrl, toggle no C e rolling por toque.
export type MovementInputState = {
  forward: boolean;
  left: boolean;
  backward: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  rollPressed: boolean;
  descend: boolean;
};

export type MovementInputSystem = {
  setEnabled: (enabled: boolean) => void;
  getState: () => MovementInputState;
  dispose: () => void;
};

const HOLD_KEY_TO_DIRECTION: Record<string, keyof Omit<MovementInputState, "crouch"> | "crouch"> = {
  KeyW: "forward",
  KeyA: "left",
  KeyS: "backward",
  KeyD: "right",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  ControlLeft: "crouch",
  ControlRight: "crouch",
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
    rollPressed: false,
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
    rollPressed: state.rollPressed,
    descend: state.descend
  };
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable;
}

export function createMovementInputSystem(): MovementInputSystem {
  let enabled = true;
  let state = createInitialState();
  let crouchHeld = false;
  let crouchToggled = false;

  const clearState = (): void => {
    state = createInitialState();
    crouchHeld = false;
    crouchToggled = false;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!enabled) {
      return;
    }

    if (isInteractiveElement(event.target)) {
      return;
    }

    if (event.repeat) {
      event.preventDefault();
      return;
    }

    if (event.code === "KeyC") {
      const wantsRolling = state.forward && state.sprint;
      if (wantsRolling) {
        state = {
          ...state,
          rollPressed: true
        };
        event.preventDefault();
        return;
      }

      crouchToggled = !crouchToggled;
      event.preventDefault();
      return;
    }

    const direction = HOLD_KEY_TO_DIRECTION[event.code];
    if (!direction) {
      return;
    }

    if (direction === "crouch") {
      crouchHeld = true;
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
    if (isInteractiveElement(event.target)) {
      return;
    }

    if (event.code === "KeyC") {
      if (enabled) {
        event.preventDefault();
      }
      return;
    }

    const direction = HOLD_KEY_TO_DIRECTION[event.code];
    if (!direction) {
      return;
    }

    if (direction === "crouch") {
      crouchHeld = false;
      if (enabled) {
        event.preventDefault();
      }
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
    getState: () => {
      const nextState = cloneState(state);
      nextState.crouch = crouchHeld || crouchToggled;
      state = {
        ...state,
        rollPressed: false
      };
      return nextState;
    },
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      clearState();
    }
  };
}
