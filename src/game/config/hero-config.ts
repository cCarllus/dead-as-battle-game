// Responsável por resolver configuração visual de herói sem acoplar gameplay aos transforms internos do asset.
import {
  DEFAULT_CHAMPION_ID,
  getBaseChampionById,
  isChampionId
} from "../../data/champions.catalog";
import type { ChampionId } from "../../models/champion.model";

export type HeroConfig = {
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

type HeroVisualTuning = {
  visualScale: number;
  visualOffset: {
    x: number;
    y: number;
    z: number;
  };
  visualYaw: number;
};

const DEFAULT_VISUAL_TUNING: HeroVisualTuning = {
  visualScale: 1,
  visualOffset: {
    x: 0,
    y: 0,
    z: 0
  },
  visualYaw: 0
};

const HERO_VISUAL_TUNING_BY_ID: Record<ChampionId, HeroVisualTuning> = {
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

export function resolveHeroConfig(heroId: string): HeroConfig {
  const resolvedHeroId = isChampionId(heroId) ? heroId : DEFAULT_CHAMPION_ID;
  const champion = getBaseChampionById(resolvedHeroId);
  const visualTuning = HERO_VISUAL_TUNING_BY_ID[resolvedHeroId] ?? DEFAULT_VISUAL_TUNING;

  return {
    id: champion.id,
    modelUrl: champion.modelUrl,
    animationOverrideBaseUrl: champion.animationOverrideBaseUrl ?? null,
    visualScale: visualTuning.visualScale,
    visualOffset: {
      x: visualTuning.visualOffset.x,
      y: visualTuning.visualOffset.y,
      z: visualTuning.visualOffset.z
    },
    visualYaw: visualTuning.visualYaw
  };
}
