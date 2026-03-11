// Responsável por resolver definições data-driven de runtime, animação e áudio por personagem.
import { DEFAULT_CHAMPION_ID } from "../../data/champions.catalog";
import { DEFAULT_CHARACTER_RUNTIME_CONFIG, type CharacterRuntimeConfig } from "./character-config";

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
    return {
      ...baseConfig,
      locomotion: { ...baseConfig.locomotion }
    };
  }

  return {
    ...baseConfig,
    ...override,
    locomotion: {
      ...baseConfig.locomotion,
      ...override.locomotion
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
