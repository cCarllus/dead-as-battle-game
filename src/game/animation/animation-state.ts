// Responsável por transformar estado de movimento/gameplay em comandos padronizados de animação.
import type { AnimationCommand } from "./animation-command";

export type MovementDirection = "none" | "forward" | "backward" | "left" | "right";

export type AnimationGameplayState = {
  isMoving: boolean;
  movementDirection: MovementDirection;
  isSprinting: boolean;
  isJumping: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  attackComboIndex: 0 | 1 | 2 | 3;
  isHitReacting: boolean;
};

export function createDefaultAnimationGameplayState(): AnimationGameplayState {
  return {
    isMoving: false,
    movementDirection: "none",
    isSprinting: false,
    isJumping: false,
    isUltimateActive: false,
    isBlocking: false,
    attackComboIndex: 0,
    isHitReacting: false
  };
}

function resolveAttackCommand(attackComboIndex: 1 | 2 | 3): AnimationCommand {
  switch (attackComboIndex) {
    case 2:
      return "attack2";
    case 3:
      return "attack3";
    case 1:
    default:
      return "attack1";
  }
}

export function resolveAnimationCommandFromGameplay(
  gameplayState: AnimationGameplayState
): AnimationCommand {
  if (gameplayState.isUltimateActive) {
    return "ultimate";
  }

  if (gameplayState.attackComboIndex > 0) {
    return resolveAttackCommand(gameplayState.attackComboIndex as 1 | 2 | 3);
  }

  if (gameplayState.isBlocking) {
    return "block";
  }

  if (gameplayState.isHitReacting) {
    return "hit";
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
