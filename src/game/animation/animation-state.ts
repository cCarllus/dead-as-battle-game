// Responsável por transformar estado de movimento/gameplay em comandos padronizados de animação.
import type { AnimationCommand } from "./animation-command";

export type MovementDirection = "none" | "forward" | "backward" | "left" | "right";

export type AnimationGameplayState = {
  isMoving: boolean;
  movementDirection: MovementDirection;
  isSprinting: boolean;
  isJumping: boolean;
  isUltimateActive: boolean;
};

export function createDefaultAnimationGameplayState(): AnimationGameplayState {
  return {
    isMoving: false,
    movementDirection: "none",
    isSprinting: false,
    isJumping: false,
    isUltimateActive: false
  };
}

export function resolveAnimationCommandFromGameplay(
  gameplayState: AnimationGameplayState
): AnimationCommand {
  if (gameplayState.isUltimateActive) {
    return "ultimate";
  }

  if (gameplayState.isJumping) {
    return "jump";
  }

  if (!gameplayState.isMoving) {
    return "idle";
  }

  if (gameplayState.isSprinting) {
    return "run";
  }

  switch (gameplayState.movementDirection) {
    case "backward":
      return "walkBack";
    case "left":
      return "walkLeft";
    case "right":
      return "walkRight";
    case "forward":
      return "walk";
    default:
      return "idle";
  }
}
