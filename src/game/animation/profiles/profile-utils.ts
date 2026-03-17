// Responsável por compor perfis de animação base + overrides específicos por herói.
import type { HeroAnimationConfig } from "../animation-types";

export type HeroAnimationConfigOverrides = {
  heroId: string;
  embeddedCommandToGroupName?: HeroAnimationConfig["embeddedCommandToGroupName"];
  overrideAssetByCommand?: HeroAnimationConfig["overrideAssetByCommand"];
  loopedCommands?: HeroAnimationConfig["loopedCommands"];
  allowEmbeddedFallback?: boolean;
};

export function createHeroAnimationConfig(
  baseConfig: HeroAnimationConfig,
  overrides: HeroAnimationConfigOverrides
): HeroAnimationConfig {
  return {
    heroId: overrides.heroId,
    embeddedCommandToGroupName: {
      ...baseConfig.embeddedCommandToGroupName,
      ...(overrides.embeddedCommandToGroupName ?? {})
    },
    overrideAssetByCommand: {
      ...(baseConfig.overrideAssetByCommand ?? {}),
      ...(overrides.overrideAssetByCommand ?? {})
    },
    loopedCommands: overrides.loopedCommands ?? baseConfig.loopedCommands,
    allowEmbeddedFallback: overrides.allowEmbeddedFallback ?? baseConfig.allowEmbeddedFallback
  };
}
