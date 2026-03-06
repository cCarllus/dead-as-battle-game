// Responsável por pré-carregar e tocar áudio de seleção de campeão após desbloqueio do navegador.
import type { ChampionId } from "../models/champion.model";
import type { GameSettings } from "./settings.service";

export type AudioService = {
  playChampionSelect: (championId: ChampionId) => void;
  applySettings: (settings: Pick<GameSettings, "muteAll" | "masterVolume">) => void;
  dispose: () => void;
};

export type AudioServiceDependencies = {
  selectAudioByChampionId: Record<ChampionId, string>;
  volume?: number;
};

export function createAudioService({
  selectAudioByChampionId,
  volume = 0.6
}: AudioServiceDependencies): AudioService {
  const audioByChampionId = new Map<ChampionId, HTMLAudioElement>();
  let activeAudio: HTMLAudioElement | null = null;
  let isAudioUnlocked = false;
  let isDisposed = false;
  let isMuted = false;
  let masterVolume = 80;

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

  const refreshVolumes = (): void => {
    const nextVolume = getOutputVolume();
    audioByChampionId.forEach((audio) => {
      audio.volume = nextVolume;
    });
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

  window.addEventListener("pointerdown", unlockAudio, true);
  window.addEventListener("keydown", unlockAudio, true);
  window.addEventListener("touchstart", unlockAudio, true);

  Object.entries(selectAudioByChampionId).forEach(([id, url]) => {
    const championId = id as ChampionId;
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = getOutputVolume();
    audioByChampionId.set(championId, audio);
  });

  return {
    applySettings: (settings) => {
      if (isDisposed) {
        return;
      }

      isMuted = settings.muteAll;
      masterVolume = normalizeMasterVolume(settings.masterVolume);
      refreshVolumes();

      if (isMuted && activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }
    },
    playChampionSelect: (championId) => {
      if (!isAudioUnlocked || isDisposed || isMuted) {
        return;
      }

      const audio = audioByChampionId.get(championId);
      if (!audio) {
        return;
      }

      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      }

      audio.currentTime = 0;
      audio.volume = getOutputVolume();
      activeAudio = audio;

      void audio.play().catch(() => {
        // Ignore reproduções bloqueadas/interrompidas pelo navegador.
      });
    },
    dispose: () => {
      isDisposed = true;
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
      window.removeEventListener("touchstart", unlockAudio, true);

      audioByChampionId.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });

      audioByChampionId.clear();
      activeAudio = null;
    }
  };
}
