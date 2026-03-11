// Responsável por definir comandos de animação padronizados consumidos pela gameplay.
export const ANIMATION_COMMANDS = [
  "idle",
  "walk",
  "walkBack",
  "walkLeft",
  "walkRight",
  "run",
  "runBack",
  "runLeft",
  "runRight",
  "jump",
  "jumpStart",
  "inAir",
  "fallLoop",
  "land",
  "crouchIdle",
  "crouchWalk",
  "slideStart",
  "slideLoop",
  "slideEnd",
  "wallRun",
  "doubleJump",
  "runStop",
  "turnLeft",
  "turnRight",
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
  "walkBack",
  "walkLeft",
  "walkRight",
  "run",
  "runBack",
  "runLeft",
  "runRight",
  "inAir",
  "fallLoop",
  "crouchIdle",
  "crouchWalk",
  "slideLoop",
  "wallRun",
  "block"
] as const;
