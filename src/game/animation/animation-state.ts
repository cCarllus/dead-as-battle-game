// Responsável por transformar estado de movimento/gameplay em comandos padronizados de animação.
import type { AnimationCommand } from "./animation-command";
import type { CharacterLocomotionState, MovementDirection } from "../locomotion/locomotion-state";
import type { LocomotionAnimationState } from "./movement-animation-state-machine";

export type { MovementDirection } from "../locomotion/locomotion-state";

export type AnimationGameplayState = {
  isDead: boolean;
  isMoving: boolean;
  movementDirection: MovementDirection;
  isSprinting: boolean;
  isJumping: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isWallRunning: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  attackComboIndex: 0 | 1 | 2 | 3;
  isHitReacting: boolean;
  locomotionState?: CharacterLocomotionState | LocomotionAnimationState;
};

export function createDefaultAnimationGameplayState(): AnimationGameplayState {
  return {
    isDead: false,
    isMoving: false,
    movementDirection: "none",
    isSprinting: false,
    isJumping: false,
    isCrouching: false,
    isSliding: false,
    isWallRunning: false,
    isUltimateActive: false,
    isBlocking: false,
    attackComboIndex: 0,
    isHitReacting: false,
    locomotionState: "Idle"
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
  if (gameplayState.isDead) {
    return "death";
  }

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

  if (gameplayState.locomotionState) {
    switch (gameplayState.locomotionState) {
      case "JumpStart":
      case "jumpStart":
        return "jump";
      case "DoubleJump":
        return "doubleJump";
      case "InAir":
      case "inAir":
      case "Fall":
        return "inAir";
      case "Land":
      case "land":
        return "land";
      case "RunStop":
        return "runStop";
      case "Slide":
        return "slideLoop";
      case "Crouch":
        return "crouchIdle";
      case "CrouchWalk":
        return "crouchWalk";
      case "Run":
      case "run":
        return "run";
      case "Walk":
      case "walk":
        return "walk";
      case "Idle":
      case "idle":
      default:
        return "idle";
    }
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

  return "walk";
}
