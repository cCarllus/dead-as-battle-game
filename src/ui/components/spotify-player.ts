const DEFAULT_SPOTIFY_PLAYLIST_SRC =
  "https://open.spotify.com/embed/playlist/42RchqGBS1bNChMFgVfKs3?utm_source=generator&theme=0";

const INTERACTION_RETRY_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "touchstart"
];

function withAutoplay(src: string): string {
  const url = new URL(src);
  url.searchParams.set("autoplay", "1");
  return url.toString();
}

function withRetrySeed(src: string, seed: string): string {
  const url = new URL(src);
  url.searchParams.set("autoplay_retry", seed);
  return url.toString();
}

export type SpotifyLobbyPlayerHandle = {
  destroy: () => void;
};

export function createSpotifyLobbyPlayer(options: {
  root: HTMLElement;
  playlistSrc?: string;
}): SpotifyLobbyPlayerHandle {
  const container = document.createElement("div");
  container.id = "spotify-lobby-player";

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-testid", "embed-iframe");
  iframe.style.borderRadius = "12px";
  iframe.width = "100%";
  iframe.height = "152";
  iframe.frameBorder = "0";
  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute(
    "allow",
    "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
  );
  iframe.loading = "lazy";

  container.appendChild(iframe);
  options.root.appendChild(container);

  const autoplaySrc = withAutoplay(options.playlistSrc ?? DEFAULT_SPOTIFY_PLAYLIST_SRC);
  let destroyed = false;
  let retriedAfterInteraction = false;
  let cleanupListeners: (() => void) | null = null;
  let stopListeningTimeoutId: number | null = null;

  const applyAutoplaySrc = (src: string): void => {
    iframe.src = src;
  };

  const stopListeningForInteraction = (): void => {
    if (cleanupListeners) {
      cleanupListeners();
      cleanupListeners = null;
    }

    if (stopListeningTimeoutId !== null) {
      window.clearTimeout(stopListeningTimeoutId);
      stopListeningTimeoutId = null;
    }
  };

  const retryPlaybackAfterInteraction = (): void => {
    if (destroyed || retriedAfterInteraction) {
      return;
    }

    retriedAfterInteraction = true;
    applyAutoplaySrc(withRetrySeed(autoplaySrc, String(Date.now())));
    stopListeningForInteraction();
  };

  applyAutoplaySrc(autoplaySrc);

  const interactionListener = (): void => {
    retryPlaybackAfterInteraction();
  };

  INTERACTION_RETRY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, interactionListener, { capture: true });
  });

  cleanupListeners = () => {
    INTERACTION_RETRY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, interactionListener, { capture: true });
    });
  };

  // Se não houver interação logo após entrar no lobby, removemos listeners
  // para manter o runtime limpo.
  stopListeningTimeoutId = window.setTimeout(() => {
    stopListeningForInteraction();
  }, 15_000);

  return {
    destroy: () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      stopListeningForInteraction();
      container.remove();
    }
  };
}

export function destroySpotifyLobbyPlayer(
  player: SpotifyLobbyPlayerHandle | null | undefined
): void {
  player?.destroy();
}
