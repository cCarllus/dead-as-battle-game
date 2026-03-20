import type { ChampionId } from "@/shared/champions/champion.model";
import type { GameSettings } from "./settings.service";

export type MenuAudioPageId =
  | "loading"
  | "nickname"
  | "home"
  | "champions"
  | "notes"
  | "settings"
  | "match";

export type StopMusicOptions = {
  fadeMs?: number;
};

export type PlayPageMusicOptions = StopMusicOptions & {
  championId?: ChampionId;
  restart?: boolean;
};

export type MenuAudioManager = {
  playPageMusic: (pageId: MenuAudioPageId, options?: PlayPageMusicOptions) => void;
  playChampionTheme: (championId: ChampionId, options?: Omit<PlayPageMusicOptions, "championId">) => void;
  stopMusic: () => void;
  fadeOutMusic: (fadeMs?: number) => Promise<void>;
  applySettings: (settings: Pick<GameSettings, "muteAll" | "masterVolume">) => void;
  dispose: () => void;
};

export type MenuAudioManagerDependencies = {
  championThemeById: Record<ChampionId, string>;
  volume?: number;
};

const DEFAULT_FADE_MS = 180;

export function createMenuAudioManager({
  championThemeById,
  volume = 0.6
}: MenuAudioManagerDependencies): MenuAudioManager {
  const audioByChampionId = new Map<ChampionId, HTMLAudioElement>();
  let activeAudio: HTMLAudioElement | null = null;
  let activeTrackKey: string | null = null;
  let activePage: MenuAudioPageId | null = null;
  let isAudioUnlocked = false;
  let isDisposed = false;
  let isMuted = false;
  let masterVolume = 80;
  let fadeFrameId: number | null = null;
  let fadeToken = 0;

  const normalizeMasterVolume = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 80;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  };

  const getOutputVolume = (): number => {
    if (isMuted) {
      return 0;
    }

    const normalizedMaster = normalizeMasterVolume(masterVolume) / 100;
    return Math.max(0, Math.min(1, normalizedMaster * volume));
  };

  const resetAudioElement = (audio: HTMLAudioElement): void => {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = getOutputVolume();
  };

  const refreshVolumes = (): void => {
    const nextVolume = getOutputVolume();
    audioByChampionId.forEach((audio) => {
      audio.volume = nextVolume;
    });
  };

  const cancelFade = (): void => {
    fadeToken += 1;

    if (fadeFrameId !== null) {
      window.cancelAnimationFrame(fadeFrameId);
      fadeFrameId = null;
    }

    if (activeAudio) {
      activeAudio.volume = getOutputVolume();
    }
  };

  const stopActiveAudio = (): void => {
    cancelFade();

    if (!activeAudio) {
      activeTrackKey = null;
      return;
    }

    resetAudioElement(activeAudio);
    activeAudio = null;
    activeTrackKey = null;
  };

  const unlockAudio = (): void => {
    if (isDisposed) {
      return;
    }

    isAudioUnlocked = true;
    window.removeEventListener("pointerdown", unlockAudio, true);
    window.removeEventListener("keydown", unlockAudio, true);
    window.removeEventListener("touchstart", unlockAudio, true);
  };

  const playAudio = (audio: HTMLAudioElement): void => {
    audio.volume = getOutputVolume();
    void audio.play().catch(() => {
      // Ignore reproduções bloqueadas ou interrompidas pelo navegador.
    });
  };

  const playChampionTrack = (
    championId: ChampionId,
    options: Omit<PlayPageMusicOptions, "championId"> = {}
  ): void => {
    if (isDisposed || isMuted || !isAudioUnlocked) {
      return;
    }

    const audio = audioByChampionId.get(championId);
    if (!audio) {
      return;
    }

    const trackKey = `champion:${championId}`;
    const shouldRestart = options.restart ?? false;

    if (activeAudio === audio && activeTrackKey === trackKey) {
      cancelFade();

      if (audio.paused || shouldRestart) {
        audio.currentTime = 0;
        playAudio(audio);
      }

      return;
    }

    stopActiveAudio();
    activeAudio = audio;
    activeTrackKey = trackKey;
    audio.currentTime = 0;
    playAudio(audio);
  };

  window.addEventListener("pointerdown", unlockAudio, true);
  window.addEventListener("keydown", unlockAudio, true);
  window.addEventListener("touchstart", unlockAudio, true);

  Object.entries(championThemeById).forEach(([id, url]) => {
    const championId = id as ChampionId;
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = getOutputVolume();
    audioByChampionId.set(championId, audio);
  });

  const fadeOutMusic = async (fadeMs = DEFAULT_FADE_MS): Promise<void> => {
    if (!activeAudio) {
      activeTrackKey = null;
      return;
    }

    if (fadeMs <= 0) {
      stopActiveAudio();
      return;
    }

    cancelFade();

    const token = fadeToken;
    const audio = activeAudio;
    const startingVolume = audio.volume;

    await new Promise<void>((resolve) => {
      const startedAt = performance.now();

      const step = (now: number): void => {
        if (isDisposed || token !== fadeToken || activeAudio !== audio) {
          resolve();
          return;
        }

        const progress = Math.min(1, (now - startedAt) / fadeMs);
        audio.volume = Math.max(0, startingVolume * (1 - progress));

        if (progress >= 1) {
          resetAudioElement(audio);
          if (activeAudio === audio) {
            activeAudio = null;
            activeTrackKey = null;
          }
          fadeFrameId = null;
          resolve();
          return;
        }

        fadeFrameId = window.requestAnimationFrame(step);
      };

      fadeFrameId = window.requestAnimationFrame(step);
    });
  };

  return {
    playPageMusic: (pageId, options = {}) => {
      if (isDisposed) {
        return;
      }

      activePage = pageId;

      if (pageId !== "champions") {
        if (options.fadeMs === 0) {
          stopActiveAudio();
          return;
        }

        void fadeOutMusic(options.fadeMs);
        return;
      }

      const championId = options.championId;
      if (!championId) {
        stopActiveAudio();
        return;
      }

      playChampionTrack(championId, options);
    },
    playChampionTheme: (championId, options = {}) => {
      if (isDisposed || activePage !== "champions") {
        return;
      }

      playChampionTrack(championId, options);
    },
    stopMusic: () => {
      stopActiveAudio();
    },
    fadeOutMusic,
    applySettings: (settings) => {
      if (isDisposed) {
        return;
      }

      isMuted = settings.muteAll;
      masterVolume = normalizeMasterVolume(settings.masterVolume);
      refreshVolumes();

      if (isMuted) {
        stopActiveAudio();
      }
    },
    dispose: () => {
      isDisposed = true;
      activePage = null;
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
      window.removeEventListener("touchstart", unlockAudio, true);
      stopActiveAudio();
      audioByChampionId.forEach((audio) => {
        resetAudioElement(audio);
      });
      audioByChampionId.clear();
    }
  };
}
