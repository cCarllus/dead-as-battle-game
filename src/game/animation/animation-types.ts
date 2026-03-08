// Responsável por tipar contratos compartilhados de configuração de animação por herói.
import type { AnimationCommand } from "./animation-command";

export type HeroAnimationCommandMap = Partial<Record<AnimationCommand, string>>;

export type HeroAnimationConfig = {
  heroId: string;
  commandToGroupName: HeroAnimationCommandMap;
  loopedCommands?: readonly AnimationCommand[];
};
