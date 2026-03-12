// Responsável por interpolar o personagem do hang até o landing point final durante a animação de climb.
import { Vector3 } from "@babylonjs/core";
import type { LedgeGrabCandidate } from "./ledge-detection-system";

export type LedgeClimbStepResult = {
  isClimbing: boolean;
  didFinish: boolean;
  transform: { x: number; y: number; z: number; rotationY: number } | null;
  ledge: LedgeGrabCandidate | null;
};

export type LedgeClimbSystem = {
  start: (input: { ledge: LedgeGrabCandidate; nowMs: number; durationMs: number }) => void;
  step: (input: { nowMs: number }) => LedgeClimbStepResult;
  isActive: () => boolean;
  reset: () => void;
};

type ActiveClimb = {
  ledge: LedgeGrabCandidate;
  startedAtMs: number;
  durationMs: number;
};

function easeInOutCubic(alpha: number): number {
  if (alpha < 0.5) {
    return 4 * alpha * alpha * alpha;
  }

  return 1 - Math.pow(-2 * alpha + 2, 3) / 2;
}

function lerpVector(from: Vector3, to: Vector3, alpha: number): Vector3 {
  return new Vector3(
    from.x + (to.x - from.x) * alpha,
    from.y + (to.y - from.y) * alpha,
    from.z + (to.z - from.z) * alpha
  );
}

export function createLedgeClimbSystem(): LedgeClimbSystem {
  let activeClimb: ActiveClimb | null = null;

  return {
    start: (input) => {
      activeClimb = {
        ledge: input.ledge,
        startedAtMs: input.nowMs,
        durationMs: Math.max(1, input.durationMs)
      };
    },
    step: (input) => {
      if (!activeClimb) {
        return {
          isClimbing: false,
          didFinish: false,
          transform: null,
          ledge: null
        };
      }

      const elapsedMs = Math.max(0, input.nowMs - activeClimb.startedAtMs);
      const rawAlpha = Math.min(1, elapsedMs / activeClimb.durationMs);
      const easedAlpha = easeInOutCubic(rawAlpha);
      const position = lerpVector(
        activeClimb.ledge.hangPosition,
        activeClimb.ledge.standPosition,
        easedAlpha
      );

      const result: LedgeClimbStepResult = {
        isClimbing: rawAlpha < 1,
        didFinish: rawAlpha >= 1,
        transform: {
          x: position.x,
          y: position.y,
          z: position.z,
          rotationY: activeClimb.ledge.rotationY
        },
        ledge: activeClimb.ledge
      };

      if (rawAlpha >= 1) {
        activeClimb = null;
      }

      return result;
    },
    isActive: () => activeClimb !== null,
    reset: () => {
      activeClimb = null;
    }
  };
}
