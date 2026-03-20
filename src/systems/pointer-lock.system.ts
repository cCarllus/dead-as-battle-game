// Responsável por isolar Pointer Lock no canvas da partida e publicar estado de captura do mouse.

type VendorPointerLockDocument = Document & {
  mozPointerLockElement?: Element | null;
  webkitPointerLockElement?: Element | null;
  msPointerLockElement?: Element | null;
  mozExitPointerLock?: () => void;
  webkitExitPointerLock?: () => void;
};

type VendorPointerLockCanvas = HTMLCanvasElement & {
  mozRequestPointerLock?: () => void;
  webkitRequestPointerLock?: () => void;
};

function getPointerLockElement(): Element | null {
  const doc = document as VendorPointerLockDocument;
  return doc.pointerLockElement ?? doc.mozPointerLockElement ?? doc.webkitPointerLockElement ?? doc.msPointerLockElement ?? null;
}

function requestCanvasPointerLock(canvas: HTMLCanvasElement): void {
  const candidate = canvas as VendorPointerLockCanvas;

  if (typeof candidate.requestPointerLock === "function") {
    candidate.requestPointerLock();
    return;
  }

  if (typeof candidate.mozRequestPointerLock === "function") {
    candidate.mozRequestPointerLock();
    return;
  }

  if (typeof candidate.webkitRequestPointerLock === "function") {
    candidate.webkitRequestPointerLock();
  }
}

function exitPointerLock(): void {
  const doc = document as VendorPointerLockDocument;
  if (typeof doc.exitPointerLock === "function") {
    doc.exitPointerLock();
    return;
  }

  if (typeof doc.mozExitPointerLock === "function") {
    doc.mozExitPointerLock();
    return;
  }

  if (typeof doc.webkitExitPointerLock === "function") {
    doc.webkitExitPointerLock();
  }
}

export type PointerLockSystem = {
  setEnabled: (enabled: boolean) => void;
  requestLock: () => void;
  releaseLock: () => void;
  isLocked: () => boolean;
  onLockChange: (listener: (locked: boolean) => void) => () => void;
  dispose: () => void;
};

export type CreatePointerLockSystemOptions = {
  canvas: HTMLCanvasElement;
  autoLockOnCanvasClick?: boolean;
  canRequestLock?: () => boolean;
};

export function createPointerLockSystem(options: CreatePointerLockSystemOptions): PointerLockSystem {
  let enabled = true;
  const listeners = new Set<(locked: boolean) => void>();

  const emitChange = (): void => {
    const locked = getPointerLockElement() === options.canvas;
    listeners.forEach((listener) => {
      listener(locked);
    });
  };

  const requestLock = (): void => {
    if (!enabled) {
      return;
    }

    if (options.canRequestLock && !options.canRequestLock()) {
      return;
    }

    if (getPointerLockElement() === options.canvas) {
      return;
    }

    requestCanvasPointerLock(options.canvas);
  };

  const releaseLock = (): void => {
    if (getPointerLockElement() !== options.canvas) {
      return;
    }

    exitPointerLock();
  };

  const onCanvasClick = (): void => {
    requestLock();
  };

  document.addEventListener("pointerlockchange", emitChange);
  if (options.autoLockOnCanvasClick !== false) {
    options.canvas.addEventListener("click", onCanvasClick);
  }

  return {
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      if (!enabled) {
        releaseLock();
      }
    },
    requestLock,
    releaseLock,
    isLocked: () => getPointerLockElement() === options.canvas,
    onLockChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      listeners.clear();
      releaseLock();
      document.removeEventListener("pointerlockchange", emitChange);
      if (options.autoLockOnCanvasClick !== false) {
        options.canvas.removeEventListener("click", onCanvasClick);
      }
    }
  };
}
