// Responsável por centralizar configuração visual de heróis (modelo + tuning de transform) para uso pela camada de animação.
import {
  DEFAULT_CHAMPION_ID,
  getBaseChampionById,
  isChampionId
} from "@/app/data/champions.catalog";
import type { ChampionId } from "@/app/models/champion.model";

export type HeroVisualConfig = {
  id: string;
  modelUrl: string | null;
  animationOverrideBaseUrl: string | null;
  visualScale: number;
  visualYaw: number;
  visualAlignment: {
    standingVisualOffset: {
      x: number;
      y: number;
      z: number;
    };
    crouchVisualOffsetY: number;
    ledgeHangVisualOffsetY: number;
    ledgeClimbVisualOffsetY: number;
    hangVisualOffset: {
      x: number;
      y: number;
      z: number;
    };
    compactGroundingToleranceY: number;
    compactGroundingMaxCorrectionY: number;
  };
};

type HeroVisualSetup = {
  visualScale: HeroVisualConfig["visualScale"];
  visualYaw: HeroVisualConfig["visualYaw"];
  visualAlignment: HeroVisualConfig["visualAlignment"];
};

const DEFAULT_VISUAL_SETUP: HeroVisualSetup = {
  visualScale: 1,
  visualYaw: 0,
  visualAlignment: {
    standingVisualOffset: {
      x: 0,
      y: 0,
      z: 0
    },
    crouchVisualOffsetY: 0,
    ledgeHangVisualOffsetY: 0,
    ledgeClimbVisualOffsetY: 0,
    hangVisualOffset: {
      x: 0,
      y: 0,
      z: 0
    },
    compactGroundingToleranceY: 0.015,
    compactGroundingMaxCorrectionY: 1.2
  }
};

const HERO_VISUAL_SETUP_BY_ID: Record<ChampionId, HeroVisualSetup> = {
  default_champion: {
    visualScale: 1,
    visualYaw: 0,
    visualAlignment: {
      standingVisualOffset: { x: 0, y: -0.04, z: 0 },
      crouchVisualOffsetY: -0.18,
      ledgeHangVisualOffsetY: 0,
      ledgeClimbVisualOffsetY: 0,
      hangVisualOffset: { x: 0, y: 0, z: 0 },
      compactGroundingToleranceY: 0.015,
      compactGroundingMaxCorrectionY: 1.2
    }
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
    visualYaw: visualSetup.visualYaw,
    visualAlignment: {
      standingVisualOffset: {
        x: visualSetup.visualAlignment.standingVisualOffset.x,
        y: visualSetup.visualAlignment.standingVisualOffset.y,
        z: visualSetup.visualAlignment.standingVisualOffset.z
      },
      crouchVisualOffsetY: visualSetup.visualAlignment.crouchVisualOffsetY,
      ledgeHangVisualOffsetY: visualSetup.visualAlignment.ledgeHangVisualOffsetY,
      ledgeClimbVisualOffsetY: visualSetup.visualAlignment.ledgeClimbVisualOffsetY,
      hangVisualOffset: {
        x: visualSetup.visualAlignment.hangVisualOffset.x,
        y: visualSetup.visualAlignment.hangVisualOffset.y,
        z: visualSetup.visualAlignment.hangVisualOffset.z
      },
      compactGroundingToleranceY: visualSetup.visualAlignment.compactGroundingToleranceY,
      compactGroundingMaxCorrectionY: visualSetup.visualAlignment.compactGroundingMaxCorrectionY
    }
  };
}
