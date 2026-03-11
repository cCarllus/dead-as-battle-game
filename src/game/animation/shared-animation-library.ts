// Responsável por definir e carregar a biblioteca compartilhada de animações-base a partir de GLBs externos.
import type { Scene } from "@babylonjs/core";
import type { AnimationCommand } from "./animation-command";
import {
  loadBoundAnimationCommandFromAsset,
  type AnimationBindingTargetResolver
} from "./animation-binding";
import type { AnimationAssetCommandMap, AnimationCommandGroupMap } from "./animation-types";

export const SHARED_ANIMATION_BASE_URL = "public/local/animations/shared";

export const DEFAULT_SHARED_EMBEDDED_GROUP_NAMES: Readonly<Record<AnimationCommand, string>> = {
  idle: "idle",
  walk: "walk",
  walkBack: "walk_back",
  walkLeft: "walk_left",
  walkRight: "walk_right",
  run: "run",
  runBack: "run_back",
  runLeft: "run_left",
  runRight: "run_right",
  jump: "jump",
  jumpStart: "jump_start",
  inAir: "jump_loop",
  fallLoop: "fall_loop",
  land: "jump_land",
  crouchIdle: "crouch_idle",
  crouchWalk: "crouch_walk",
  slideStart: "slide_start",
  slideLoop: "slide_loop",
  slideEnd: "slide_end",
  wallRun: "wall_run",
  doubleJump: "double_jump",
  runStop: "run_stop",
  turnLeft: "turn_left",
  turnRight: "turn_right",
  death: "death",
  ultimate: "ultimate",
  attack1: "attack_1",
  attack2: "attack_2",
  attack3: "attack_3",
  block: "block",
  hit: "hit"
};

export const SHARED_ANIMATION_ASSET_BY_COMMAND: Readonly<AnimationAssetCommandMap> = {
  idle: "idle.glb",
  walk: "walk.glb",
  run: "run.glb",
  runStop: "run_stop.glb",
  jump: "jump.glb",
  inAir: "jump_loop.glb",
  land: "jump_land.glb",
  crouchIdle: "crouch_idle.glb",
  crouchWalk: "crouch_walk.glb",
  slideLoop: "slide.glb",
  doubleJump: "jump.glb"
};

export type LoadSharedAnimationLibraryOptions = {
  scene: Scene;
  binding: AnimationBindingTargetResolver;
  loggerPrefix?: string;
};

export async function loadSharedAnimationLibrary(
  options: LoadSharedAnimationLibraryOptions
): Promise<AnimationCommandGroupMap> {
  const entries = await Promise.all(
    Object.entries(SHARED_ANIMATION_ASSET_BY_COMMAND).map(async ([command, assetDefinition]) => {
      const group = await loadBoundAnimationCommandFromAsset({
        scene: options.scene,
        command: command as AnimationCommand,
        assetDefinition,
        baseUrl: SHARED_ANIMATION_BASE_URL,
        binding: options.binding,
        loggerPrefix: options.loggerPrefix,
        sourceLabel: "shared"
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
