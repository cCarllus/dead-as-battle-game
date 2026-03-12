// Responsável por definir e carregar a biblioteca compartilhada de animações-base a partir de GLBs externos.
import type { Scene } from "@babylonjs/core";
import type { AnimationCommand } from "./animation-command";
import {
  loadBoundAnimationCommandFromAsset,
  type AnimationBindingTargetResolver
} from "./animation-binding";
import { LEDGE_ANIMATION_ASSET_BY_COMMAND } from "./ledge-animation-config";
import type { AnimationAssetCommandMap, AnimationCommandGroupMap } from "./animation-types";

export const SHARED_ANIMATION_BASE_URL = "public/local/animations/shared";

export const DEFAULT_SHARED_EMBEDDED_GROUP_NAMES: Readonly<Record<AnimationCommand, string>> = {
  idle: "idle",
  walk: "walk",
  run: "run",
  jump: "jump",
  inAir: "jump_loop",
  ledgeHang: "wall-hanging-idle",
  ledgeClimb: "up-wall",
  crouchIdle: "crouch_idle",
  rolling: "rolling",
  doubleJump: "double_jump",
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
  jump: "jump.glb",
  inAir: "jump_loop.glb",
  ...LEDGE_ANIMATION_ASSET_BY_COMMAND,
  crouchIdle: "crouch_idle.glb",
  rolling: "quick-roll.glb",
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
