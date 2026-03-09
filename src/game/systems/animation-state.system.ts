// Responsável por consolidar estado de gameplay em um estado de animação limpo e estável.
import type { AnimationGameplayState, MovementDirection } from "../animation/animation-state";
import type { LocomotionAnimationState } from "../animation/movement-animation-state-machine";

export type AnimationStateSystemInput = {
  isAlive: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  attackComboIndex: 0 | 1 | 2 | 3;
  isStunned: boolean;
  locomotionState: LocomotionAnimationState;
  movementDirection: MovementDirection;
};

export type AnimationStateSystem = {
  resolve: (input: AnimationStateSystemInput) => AnimationGameplayState;
};

function resolveIsMoving(locomotionState: LocomotionAnimationState): boolean {
  return locomotionState === "walk" || locomotionState === "run";
}

function resolveIsJumping(locomotionState: LocomotionAnimationState): boolean {
  return locomotionState === "jumpStart" || locomotionState === "inAir";
}

export function createAnimationStateSystem(): AnimationStateSystem {
  return {
    resolve: (input) => {
      if (!input.isAlive) {
        return {
          isDead: true,
          isMoving: false,
          movementDirection: "none",
          isSprinting: false,
          isJumping: false,
          isUltimateActive: false,
          isBlocking: false,
          attackComboIndex: 0,
          isHitReacting: false,
          locomotionState: "idle"
        };
      }

      const isBlocking = input.isBlocking && input.attackComboIndex === 0;
      const isHitReacting = input.isStunned && !isBlocking && input.attackComboIndex === 0;

      return {
        isDead: false,
        isMoving: resolveIsMoving(input.locomotionState),
        movementDirection: resolveIsMoving(input.locomotionState) ? input.movementDirection : "none",
        isSprinting: input.locomotionState === "run",
        isJumping: resolveIsJumping(input.locomotionState),
        isUltimateActive: input.isUltimateActive,
        isBlocking,
        attackComboIndex: input.attackComboIndex,
        isHitReacting,
        locomotionState: input.locomotionState
      };
    }
  };
}
