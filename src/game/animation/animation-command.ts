// Responsável por definir comandos de animação padronizados consumidos pela gameplay.
export const ANIMATION_COMMANDS = [
  "idle",
  "walk",
  "run",
  "jump",
  "inAir",
  "ledgeHang",
  "ledgeClimb",
  "crouchIdle",
  "rolling",
  "doubleJump",
  "death",
  "ultimate",
  "attack1",
  "attack2",
  "attack3",
  "block",
  "hit"
] as const;

export type AnimationCommand = (typeof ANIMATION_COMMANDS)[number];

export function isAnimationCommand(value: string): value is AnimationCommand {
  return ANIMATION_COMMANDS.some((command) => command === value);
}

export const LOOPED_ANIMATION_COMMANDS: readonly AnimationCommand[] = [
  "idle",
  "walk",
  "run",
  "inAir",
  "ledgeHang",
  "crouchIdle",
  "block"
] as const;
