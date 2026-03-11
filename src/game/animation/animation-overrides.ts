// Responsável por compor biblioteca compartilhada e overrides específicos de herói em um mapa único de comandos.
import { LOOPED_ANIMATION_COMMANDS, type AnimationCommand } from "./animation-command";
import { SHARED_LOCOMOTION_ANIMATION_LIBRARY } from "./shared-animation-library";
import type { HeroAnimationConfig } from "./animation-types";

export function createAnimationConfigWithOverrides(baseConfig: HeroAnimationConfig): HeroAnimationConfig {
  const mergedLoopedCommands = new Set<AnimationCommand>([
    ...LOOPED_ANIMATION_COMMANDS,
    ...(baseConfig.loopedCommands ?? [])
  ]);

  return {
    heroId: baseConfig.heroId,
    commandToGroupName: {
      ...SHARED_LOCOMOTION_ANIMATION_LIBRARY,
      ...baseConfig.commandToGroupName
    },
    loopedCommands: Array.from(mergedLoopedCommands)
  };
}

