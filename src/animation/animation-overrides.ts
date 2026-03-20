// Responsável por normalizar config de animação por herói sem misturar biblioteca shared ao fallback embutido.
import { LOOPED_ANIMATION_COMMANDS, type AnimationCommand } from "./animation-command";
import { DEFAULT_SHARED_EMBEDDED_GROUP_NAMES } from "./shared-animation-library";
import type { HeroAnimationConfig } from "./animation-types";

export function normalizeHeroAnimationConfig(baseConfig: HeroAnimationConfig): HeroAnimationConfig {
  const mergedLoopedCommands = new Set<AnimationCommand>([
    ...LOOPED_ANIMATION_COMMANDS,
    ...(baseConfig.loopedCommands ?? [])
  ]);

  return {
    heroId: baseConfig.heroId,
    embeddedCommandToGroupName: {
      ...DEFAULT_SHARED_EMBEDDED_GROUP_NAMES,
      ...baseConfig.embeddedCommandToGroupName
    },
    overrideAssetByCommand: {
      ...(baseConfig.overrideAssetByCommand ?? {})
    },
    loopedCommands: Array.from(mergedLoopedCommands),
    allowEmbeddedFallback: baseConfig.allowEmbeddedFallback ?? true
  };
}
