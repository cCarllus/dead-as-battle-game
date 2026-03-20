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
  isRolling: boolean;
  isWallRunning: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  attackComboIndex: 0 | 1 | 2 | 3;
  activeSkillId: string;
  isHitReacting: boolean;
  locomotionState?: CharacterLocomotionState | LocomotionAnimationState;
  restartCommand?: AnimationCommand | null;
};

export function createDefaultAnimationGameplayState(): AnimationGameplayState {
  return {
    isDead: false,
    isMoving: false,
    movementDirection: "none",
    isSprinting: false,
    isJumping: false,
    isCrouching: false,
    isRolling: false,
    isWallRunning: false,
    isUltimateActive: false,
    isBlocking: false,
    attackComboIndex: 0,
    activeSkillId: "",
    isHitReacting: false,
    locomotionState: "Idle",
    restartCommand: null
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

  if (gameplayState.attackComboIndex > 0) {
    return resolveAttackCommand(gameplayState.attackComboIndex as 1 | 2 | 3);
  }

  if (gameplayState.activeSkillId) {
    switch (gameplayState.activeSkillId) {
      case "fireball":
        return "fireball";
      case "kick-skill":
        return "kickSkill";
      case "reapet-kick":
        return "repeatKick";
      case "spell":
        return "spell";
      case "ultimate":
        return "ultimate";
      default:
        break;
    }
  }

  if (gameplayState.isUltimateActive) {
    return "ultimate";
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
      case "Jumping":
        return "jump";
      case "DoubleJump":
        return "doubleJump";
      case "InAir":
      case "inAir":
      case "Fall":
      case "Falling":
        return "inAir";
      case "LedgeHang":
      case "Hanging":
        return "ledgeHang";
      case "LedgeClimb":
      case "ClimbingUp":
      case "MantlingLowObstacle":
        return "ledgeClimb";
      case "Rolling":
        return "rolling";
      case "Crouch":
        return "crouchIdle";
      case "Running":
      case "Run":
      case "run":
        return "run";
      case "Walk":
      case "walk":
        return "walk";
      case "Grounded":
      case "Idle":
      case "idle":
        return "idle";
      default:
        return "walk";
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
