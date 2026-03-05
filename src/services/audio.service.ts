// Responsável por pré-carregar e tocar áudio de seleção de campeão após desbloqueio do navegador.
import type { ChampionId } from "../models/champion.model";

export type AudioService = {
  playChampionSelect: (championId: ChampionId) => void;
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
    audio.volume = volume;
    audioByChampionId.set(championId, audio);
  });

  return {
    playChampionSelect: (championId) => {
      if (!isAudioUnlocked || isDisposed) {
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
      audio.volume = volume;
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
