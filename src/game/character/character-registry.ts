// Responsável por resolver definições data-driven de runtime, animação e áudio por personagem.
import { DEFAULT_CHAMPION_ID } from "@/shared/champions/champions.catalog";
import {
  DEFAULT_CHARACTER_RUNTIME_CONFIG,
  cloneCharacterRuntimeConfig,
  type CharacterRuntimeConfig
} from "./character-config";
import { cloneColliderConfig } from "./character-collider-config";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type CharacterDefinition = {
  heroId: string;
  runtimeConfig: CharacterRuntimeConfig;
  audioProfileId: string;
};

const CHARACTER_CONFIG_OVERRIDES: Record<string, DeepPartial<CharacterRuntimeConfig>> = {
  default_champion: {}
};

function mergeRuntimeConfig(
  baseConfig: CharacterRuntimeConfig,
  override: DeepPartial<CharacterRuntimeConfig> | undefined
): CharacterRuntimeConfig {
  if (!override) {
    return cloneCharacterRuntimeConfig(baseConfig);
  }

  return {
    ...baseConfig,
    ...override,
    collider: {
      ...cloneColliderConfig(baseConfig.collider),
      ...override.collider,
      standing: {
        ...baseConfig.collider.standing,
        ...override.collider?.standing
      },
      crouch: {
        ...baseConfig.collider.crouch,
        ...override.collider?.crouch
      },
      rolling: {
        ...baseConfig.collider.rolling,
        ...override.collider?.rolling
      },
      hanging: {
        ...baseConfig.collider.hanging,
        ...override.collider?.hanging
      },
      climbingUp: {
        ...baseConfig.collider.climbingUp,
        ...override.collider?.climbingUp
      },
      mantle: {
        ...baseConfig.collider.mantle,
        ...override.collider?.mantle
      }
    },
    anchors: {
      ...baseConfig.anchors,
      ...override.anchors
    },
    locomotion: {
      ...baseConfig.locomotion,
      ...override.locomotion
    },
    ledge: {
      ...baseConfig.ledge,
      ...override.ledge
    }
  };
}

export function resolveCharacterDefinition(heroId: string): CharacterDefinition {
  const resolvedHeroId = heroId in CHARACTER_CONFIG_OVERRIDES ? heroId : DEFAULT_CHAMPION_ID;

  return {
    heroId: resolvedHeroId,
    runtimeConfig: mergeRuntimeConfig(
      DEFAULT_CHARACTER_RUNTIME_CONFIG,
      CHARACTER_CONFIG_OVERRIDES[resolvedHeroId]
    ),
    audioProfileId: resolvedHeroId
  };
}
