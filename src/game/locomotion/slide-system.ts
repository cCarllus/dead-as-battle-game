// Responsável por encapsular gatilho, duração e momentum do slide disparado a partir do sprint.
import { Vector3 } from "@babylonjs/core";

export type SlideStepResult = {
  isSliding: boolean;
  direction: Vector3 | null;
  speed: number;
  alpha: number;
  didStart: boolean;
  didEnd: boolean;
  forcedCrouch: boolean;
};

export type SlideSystem = {
  step: (input: {
    nowMs: number;
    deltaSeconds: number;
    wantsSlide: boolean;
    canSlide: boolean;
    currentSpeed: number;
    forwardDirection: Vector3;
    minSpeed: number;
    initialSpeed: number;
    durationMs: number;
    cooldownMs: number;
  }) => SlideStepResult;
  reset: () => void;
};

export function createSlideSystem(): SlideSystem {
  let active = false;
  let slideStartedAt = 0;
  let slideCooldownUntil = 0;
  let slideSpeed = 0;
  let slideDirection = Vector3.Zero();
  let previousWantsSlide = false;

  return {
    step: (input) => {
      const wantsPress = input.wantsSlide && !previousWantsSlide;
      previousWantsSlide = input.wantsSlide;

      let didStart = false;
      let didEnd = false;

      if (
        !active &&
        wantsPress &&
        input.canSlide &&
        input.nowMs >= slideCooldownUntil &&
        input.forwardDirection.lengthSquared() > 0.0001
      ) {
        active = true;
        didStart = true;
        slideStartedAt = input.nowMs;
        slideCooldownUntil = input.nowMs + input.cooldownMs;
        slideSpeed = Math.max(input.currentSpeed * 1.08, input.initialSpeed);
        slideDirection = input.forwardDirection.normalizeToNew();
      }

      if (active) {
        const elapsedMs = input.nowMs - slideStartedAt;
        const progress = Math.min(1, elapsedMs / Math.max(1, input.durationMs));
        slideSpeed = Math.max(input.minSpeed, slideSpeed - input.deltaSeconds * 10.2);

        if (elapsedMs >= input.durationMs || slideSpeed <= input.minSpeed + 0.1) {
          active = false;
          didEnd = true;
        }

        return {
          isSliding: active,
          direction: slideDirection.clone(),
          speed: slideSpeed,
          alpha: active ? 1 - progress * 0.12 : 0,
          didStart,
          didEnd,
          forcedCrouch: active || didEnd
        };
      }

      return {
        isSliding: false,
        direction: null,
        speed: 0,
        alpha: 0,
        didStart,
        didEnd,
        forcedCrouch: false
      };
    },
    reset: () => {
      active = false;
      slideStartedAt = 0;
      slideCooldownUntil = 0;
      slideSpeed = 0;
      slideDirection = Vector3.Zero();
      previousWantsSlide = false;
    }
  };
}

