// Responsável por definir comandos de animação padronizados consumidos pela gameplay.
export const ANIMATION_COMMANDS = [
  "idle",
  "walk",
  "walkBack",
  "walkLeft",
  "walkRight",
  "run",
  "jump",
  "ultimate"
] as const;

export type AnimationCommand = (typeof ANIMATION_COMMANDS)[number];

export function isAnimationCommand(value: string): value is AnimationCommand {
  return ANIMATION_COMMANDS.some((command) => command === value);
}

export const LOOPED_ANIMATION_COMMANDS: readonly AnimationCommand[] = [
  "idle",
  "walk",
  "walkBack",
  "walkLeft",
  "walkRight",
  "run"
] as const;
