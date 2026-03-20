// Responsável por carregar overrides opcionais de animação por herói a partir de uma base URL própria.
import type { Scene } from "@babylonjs/core";
import {
  loadBoundAnimationCommandFromAsset,
  type AnimationBindingTargetResolver
} from "./animation-binding";
import type {
  AnimationCommand,
} from "./animation-command";
import type { AnimationCommandGroupMap, HeroAnimationConfig } from "./animation-types";

export type LoadHeroAnimationOverridesOptions = {
  scene: Scene;
  heroId: string;
  animationConfig: HeroAnimationConfig;
  animationOverrideBaseUrl: string | null;
  binding: AnimationBindingTargetResolver;
  loggerPrefix?: string;
};

export async function loadHeroAnimationOverrides(
  options: LoadHeroAnimationOverridesOptions
): Promise<AnimationCommandGroupMap> {
  if (!options.animationOverrideBaseUrl || !options.animationConfig.overrideAssetByCommand) {
    return {};
  }

  const overrideBaseUrl = options.animationOverrideBaseUrl;
  const entries = await Promise.all(
    Object.entries(options.animationConfig.overrideAssetByCommand).map(async ([command, assetDefinition]) => {
      if (!assetDefinition) {
        return [command as AnimationCommand, null] as const;
      }

      const group = await loadBoundAnimationCommandFromAsset({
        scene: options.scene,
        command: command as AnimationCommand,
        assetDefinition,
        baseUrl: overrideBaseUrl,
        binding: options.binding,
        loggerPrefix: options.loggerPrefix,
        sourceLabel: "override"
      });

      return [command as AnimationCommand, group] as const;
    })
  );

  return entries.reduce<AnimationCommandGroupMap>((commandMap, [command, group]) => {
    if (!group) {
      return commandMap;
    }

    commandMap[command] = group;
    return commandMap;
  }, {});
}
