// Responsável por encapsular o Fullscreen API e expor estado/assinaturas de mudança sem acoplamento com telas.

type VendorFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type VendorFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const FULLSCREEN_CHANGE_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange"
] as const;

function getFullscreenElement(): Element | null {
  const doc = document as VendorFullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.mozFullScreenElement ?? doc.msFullscreenElement ?? null;
}

function getRequestFullscreen(element: HTMLElement): (() => Promise<void> | void) | null {
  const candidate = element as VendorFullscreenElement;
  if (typeof candidate.requestFullscreen === "function") {
    return candidate.requestFullscreen.bind(candidate);
  }

  if (typeof candidate.webkitRequestFullscreen === "function") {
    return candidate.webkitRequestFullscreen.bind(candidate);
  }

  if (typeof candidate.mozRequestFullScreen === "function") {
    return candidate.mozRequestFullScreen.bind(candidate);
  }

  if (typeof candidate.msRequestFullscreen === "function") {
    return candidate.msRequestFullscreen.bind(candidate);
  }

  return null;
}

function getExitFullscreen(): (() => Promise<void> | void) | null {
  const doc = document as VendorFullscreenDocument;
  if (typeof doc.exitFullscreen === "function") {
    return doc.exitFullscreen.bind(doc);
  }

  if (typeof doc.webkitExitFullscreen === "function") {
    return doc.webkitExitFullscreen.bind(doc);
  }

  if (typeof doc.mozCancelFullScreen === "function") {
    return doc.mozCancelFullScreen.bind(doc);
  }

  if (typeof doc.msExitFullscreen === "function") {
    return doc.msExitFullscreen.bind(doc);
  }

  return null;
}

async function runMaybeAsync(operation: () => Promise<void> | void): Promise<void> {
  await Promise.resolve(operation());
}

export function isFullscreenSupported(): boolean {
  return getRequestFullscreen(document.documentElement) !== null;
}

export function isFullscreenActive(): boolean {
  return getFullscreenElement() !== null;
}

export async function enterFullscreen(target: HTMLElement = document.documentElement): Promise<boolean> {
  const requestFullscreen = getRequestFullscreen(target);
  if (!requestFullscreen) {
    return false;
  }

  if (isFullscreenActive()) {
    return true;
  }

  try {
    await runMaybeAsync(requestFullscreen);
    return isFullscreenActive();
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<boolean> {
  if (!isFullscreenActive()) {
    return true;
  }

  const requestExit = getExitFullscreen();
  if (!requestExit) {
    return false;
  }

  try {
    await runMaybeAsync(requestExit);
    return !isFullscreenActive();
  } catch {
    return false;
  }
}

export async function applyFullscreenPreference(
  fullscreen: boolean,
  target: HTMLElement = document.documentElement
): Promise<boolean> {
  if (fullscreen) {
    return enterFullscreen(target);
  }

  return exitFullscreen();
}

export type FullscreenSystem = {
  isSupported: () => boolean;
  isFullscreen: () => boolean;
  request: () => Promise<boolean>;
  exit: () => Promise<boolean>;
  applyPreference: (fullscreen: boolean) => Promise<boolean>;
  onChange: (listener: (isFullscreen: boolean) => void) => () => void;
  dispose: () => void;
};

export type CreateFullscreenSystemOptions = {
  target?: HTMLElement;
};

export function createFullscreenSystem(options: CreateFullscreenSystemOptions = {}): FullscreenSystem {
  const target = options.target ?? document.documentElement;
  const listeners = new Set<(isFullscreen: boolean) => void>();

  const emitChange = (): void => {
    const fullscreen = isFullscreenActive();
    listeners.forEach((listener) => {
      listener(fullscreen);
    });
  };

  FULLSCREEN_CHANGE_EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, emitChange);
  });

  return {
    isSupported: () => isFullscreenSupported(),
    isFullscreen: () => isFullscreenActive(),
    request: () => enterFullscreen(target),
    exit: () => exitFullscreen(),
    applyPreference: (fullscreen) => applyFullscreenPreference(fullscreen, target),
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      listeners.clear();
      FULLSCREEN_CHANGE_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, emitChange);
      });
    }
  };
}
