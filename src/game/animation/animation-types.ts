// Responsável por tipar contratos compartilhados de configuração de animação por herói.
import type { AnimationGroup } from "@babylonjs/core";
import type { AnimationCommand } from "./animation-command";

export type HeroAnimationCommandMap = Partial<Record<AnimationCommand, string>>;
export type AnimationAssetDefinition =
  | string
  | {
      fileName: string;
      groupName?: string;
      stripPositionTracks?: boolean;
    };
export type AnimationAssetCommandMap = Partial<Record<AnimationCommand, AnimationAssetDefinition>>;
export type AnimationCommandGroupMap = Partial<Record<AnimationCommand, AnimationGroup>>;

export type HeroAnimationConfig = {
  heroId: string;
  embeddedCommandToGroupName: HeroAnimationCommandMap;
  overrideAssetByCommand?: AnimationAssetCommandMap;
  loopedCommands?: readonly AnimationCommand[];
  allowEmbeddedFallback?: boolean;
};
