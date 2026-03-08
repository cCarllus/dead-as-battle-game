// Responsável por capturar input de combate (LMB/RMB) e emitir intents de ataque/bloqueio desacopladas da lógica de gameplay.
export type CombatInputSystem = {
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

export type CreateCombatInputSystemOptions = {
  canProcessInput: () => boolean;
  onAttackStart: () => void;
  onBlockStart: () => void;
  onBlockEnd: () => void;
};

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable;
}

export function createCombatInputSystem(options: CreateCombatInputSystemOptions): CombatInputSystem {
  let enabled = true;
  let isRightButtonHeld = false;

  const canAcceptInput = (eventTarget: EventTarget | null): boolean => {
    if (!enabled) {
      return false;
    }

    if (!options.canProcessInput()) {
      return false;
    }

    if (isInteractiveElement(eventTarget)) {
      return false;
    }

    return true;
  };

  const releaseBlockIfNeeded = (): void => {
    if (!isRightButtonHeld) {
      return;
    }

    isRightButtonHeld = false;
    options.onBlockEnd();
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      if (!canAcceptInput(event.target)) {
        return;
      }

      event.preventDefault();
      options.onAttackStart();
      return;
    }

    if (event.button === 2) {
      if (!canAcceptInput(event.target)) {
        return;
      }

      event.preventDefault();
      if (isRightButtonHeld) {
        return;
      }

      isRightButtonHeld = true;
      options.onBlockStart();
    }
  };

  const onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 2) {
      return;
    }

    releaseBlockIfNeeded();
  };

  const onContextMenu = (event: MouseEvent): void => {
    if (event.button !== 2) {
      return;
    }

    if (!enabled) {
      return;
    }

    event.preventDefault();
  };

  const onWindowBlur = (): void => {
    releaseBlockIfNeeded();
  };

  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("blur", onWindowBlur);

  return {
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      if (!enabled) {
        releaseBlockIfNeeded();
      }
    },
    dispose: () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("blur", onWindowBlur);
      releaseBlockIfNeeded();
    }
  };
}
