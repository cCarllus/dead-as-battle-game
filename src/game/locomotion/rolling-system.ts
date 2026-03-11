// Responsável por encapsular gatilho, duração e impulso do rolling disparado a partir da corrida.
import { Vector3 } from "@babylonjs/core";

export type RollingStepResult = {
  isRolling: boolean;
  direction: Vector3 | null;
  speed: number;
  alpha: number;
  didStart: boolean;
  didEnd: boolean;
  forcesCompactCollider: boolean;
};

export type RollingSystem = {
  step: (input: {
    nowMs: number;
    deltaSeconds: number;
    wantsRolling: boolean;
    canRoll: boolean;
    currentSpeed: number;
    forwardDirection: Vector3;
    minSpeed: number;
    initialSpeed: number;
    durationMs: number;
    cooldownMs: number;
  }) => RollingStepResult;
  reset: () => void;
};

export function createRollingSystem(): RollingSystem {
  let active = false;
  let rollingStartedAt = 0;
  let rollingCooldownUntil = 0;
  let rollingSpeed = 0;
  let rollingDirection = Vector3.Zero();

  return {
    step: (input) => {
      let didStart = false;
      let didEnd = false;

      if (
        !active &&
        input.wantsRolling &&
        input.canRoll &&
        input.nowMs >= rollingCooldownUntil &&
        input.forwardDirection.lengthSquared() > 0.0001
      ) {
        active = true;
        didStart = true;
        rollingStartedAt = input.nowMs;
        rollingCooldownUntil = input.nowMs + input.cooldownMs;
        rollingSpeed = Math.max(input.currentSpeed * 1.12, input.initialSpeed);
        rollingDirection = input.forwardDirection.normalizeToNew();
      }

      if (active) {
        const elapsedMs = input.nowMs - rollingStartedAt;
        const progress = Math.min(1, elapsedMs / Math.max(1, input.durationMs));
        rollingSpeed = Math.max(input.minSpeed, rollingSpeed - input.deltaSeconds * 12.4);

        if (elapsedMs >= input.durationMs) {
          active = false;
          didEnd = true;
        }

        return {
          isRolling: active,
          direction: rollingDirection.clone(),
          speed: rollingSpeed,
          alpha: active ? 1 - progress * 0.08 : 0,
          didStart,
          didEnd,
          forcesCompactCollider: active || didEnd
        };
      }

      return {
        isRolling: false,
        direction: null,
        speed: 0,
        alpha: 0,
        didStart,
        didEnd,
        forcesCompactCollider: false
      };
    },
    reset: () => {
      active = false;
      rollingStartedAt = 0;
      rollingCooldownUntil = 0;
      rollingSpeed = 0;
      rollingDirection = Vector3.Zero();
    }
  };
}
