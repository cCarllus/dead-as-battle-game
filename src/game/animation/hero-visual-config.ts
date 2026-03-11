// Responsável por centralizar configuração visual de heróis (modelo + tuning de transform) para uso pela camada de animação.
import {
  DEFAULT_CHAMPION_ID,
  getBaseChampionById,
  isChampionId
} from "../../data/champions.catalog";
import type { ChampionId } from "../../models/champion.model";

export type HeroVisualConfig = {
  id: string;
  modelUrl: string | null;
  animationOverrideBaseUrl: string | null;
  visualScale: number;
  visualOffset: {
    x: number;
    y: number;
    z: number;
  };
  visualYaw: number;
};

type HeroVisualSetup = {
  visualScale: number;
  visualOffset: {
    x: number;
    y: number;
    z: number;
  };
  visualYaw: number;
};

const DEFAULT_VISUAL_SETUP: HeroVisualSetup = {
  visualScale: 1,
  visualOffset: {
    x: 0,
    y: 0,
    z: 0
  },
  visualYaw: 0
};

const HERO_VISUAL_SETUP_BY_ID: Record<ChampionId, HeroVisualSetup> = {
  user: {
    visualScale: 1,
    visualOffset: { x: 0, y: 0, z: 0 },
    visualYaw: 0
  },
  sukuna: {
    visualScale: 1,
    visualOffset: { x: 0, y: 0, z: 0 },
    visualYaw: 0
  },
  kaiju_no_8: {
    visualScale: 1,
    visualOffset: { x: 0, y: 0, z: 0 },
    visualYaw: 0
  }
};

export function resolveHeroVisualConfig(heroId: string): HeroVisualConfig {
  const resolvedHeroId = isChampionId(heroId) ? heroId : DEFAULT_CHAMPION_ID;
  const champion = getBaseChampionById(resolvedHeroId);
  const visualSetup = HERO_VISUAL_SETUP_BY_ID[resolvedHeroId] ?? DEFAULT_VISUAL_SETUP;

  return {
    id: champion.id,
    modelUrl: champion.modelUrl,
    animationOverrideBaseUrl: champion.animationOverrideBaseUrl ?? null,
    visualScale: visualSetup.visualScale,
    visualOffset: {
      x: visualSetup.visualOffset.x,
      y: visualSetup.visualOffset.y,
      z: visualSetup.visualOffset.z
    },
    visualYaw: visualSetup.visualYaw
  };
}
