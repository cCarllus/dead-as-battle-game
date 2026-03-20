// Responsável por decidir estado de locomoção com transições estáveis entre idle/walk/run/jumpStart/inAir.
export type LocomotionAnimationState =
  | "idle"
  | "walk"
  | "run"
  | "jumpStart"
  | "inAir";

export type MovementAnimationStateInput = {
  nowMs: number;
  isGrounded: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  didStartJump: boolean;
};

export type MovementAnimationStateMachine = {
  resolve: (input: MovementAnimationStateInput) => LocomotionAnimationState;
  reset: () => void;
  getCurrentState: () => LocomotionAnimationState;
};

export type CreateMovementAnimationStateMachineOptions = {
  jumpStartMinDurationMs?: number;
};

const DEFAULT_JUMP_START_MIN_DURATION_MS = 130;

export function createMovementAnimationStateMachine(
  options: CreateMovementAnimationStateMachineOptions = {}
): MovementAnimationStateMachine {
  const jumpStartMinDurationMs = options.jumpStartMinDurationMs ?? DEFAULT_JUMP_START_MIN_DURATION_MS;

  let currentState: LocomotionAnimationState = "idle";
  let jumpStartUntilMs = 0;

  return {
    resolve: (input) => {
      if (input.didStartJump) {
        jumpStartUntilMs = input.nowMs + jumpStartMinDurationMs;
        currentState = "jumpStart";
        return currentState;
      }

      if (!input.isGrounded) {
        currentState = input.nowMs < jumpStartUntilMs ? "jumpStart" : "inAir";
        return currentState;
      }

      if (!input.isMoving) {
        currentState = "idle";
        return currentState;
      }

      currentState = input.isSprinting ? "run" : "walk";
      return currentState;
    },
    reset: () => {
      currentState = "idle";
      jumpStartUntilMs = 0;
    },
    getCurrentState: () => currentState
  };
}
