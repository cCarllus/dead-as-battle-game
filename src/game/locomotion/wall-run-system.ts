// Responsável por controlar entrada, direção, gravidade reduzida e saída limpa de wall run.
import { Vector3 } from "@babylonjs/core";
import type { WallCheckResult } from "./wall-check-system";
import type { WallRunSide } from "./locomotion-state";

export type WallRunStepResult = {
  isWallRunning: boolean;
  side: WallRunSide;
  direction: Vector3 | null;
  gravityScale: number;
  didStart: boolean;
  didEnd: boolean;
};

export type WallRunSystem = {
  step: (input: {
    nowMs: number;
    isGrounded: boolean;
    hasForwardIntent: boolean;
    canWallRun: boolean;
    desiredDirection: Vector3;
    verticalVelocity: number;
    wallCheck: WallCheckResult;
    durationMs: number;
    gravityScale: number;
    minEntryFallSpeed: number;
  }) => WallRunStepResult;
  reset: () => void;
};

function resolveWallRunDirection(normal: Vector3, desiredDirection: Vector3): Vector3 {
  const up = Vector3.UpReadOnly;
  const tangentA = Vector3.Cross(up, normal).normalize();
  const tangentB = tangentA.scale(-1);
  if (desiredDirection.lengthSquared() <= 0.0001) {
    return tangentA;
  }

  return Vector3.Dot(tangentA, desiredDirection) >= Vector3.Dot(tangentB, desiredDirection)
    ? tangentA
    : tangentB;
}

export function createWallRunSystem(): WallRunSystem {
  let activeSide: WallRunSide = "none";
  let activeUntilMs = 0;

  return {
    step: (input) => {
      let didStart = false;
      let didEnd = false;
      let dominant = input.wallCheck.dominant;

      const canStayActive =
        activeSide !== "none" &&
        !input.isGrounded &&
        input.hasForwardIntent &&
        input.canWallRun &&
        input.nowMs <= activeUntilMs &&
        dominant?.isRunnable;

      if (!canStayActive && activeSide !== "none") {
        activeSide = "none";
        activeUntilMs = 0;
        didEnd = true;
      }

      if (
        activeSide === "none" &&
        !input.isGrounded &&
        input.hasForwardIntent &&
        input.canWallRun &&
        dominant?.isRunnable &&
        input.verticalVelocity <= input.minEntryFallSpeed
      ) {
        activeSide = dominant.side;
        activeUntilMs = input.nowMs + input.durationMs;
        didStart = true;
      }

      if (activeSide === "none") {
        return {
          isWallRunning: false,
          side: "none",
          direction: null,
          gravityScale: 1,
          didStart,
          didEnd
        };
      }

      dominant = activeSide === "left" ? input.wallCheck.left : input.wallCheck.right;
      if (!dominant.normal) {
        activeSide = "none";
        return {
          isWallRunning: false,
          side: "none",
          direction: null,
          gravityScale: 1,
          didStart,
          didEnd: true
        };
      }

      return {
        isWallRunning: true,
        side: activeSide,
        direction: resolveWallRunDirection(dominant.normal, input.desiredDirection),
        gravityScale: input.gravityScale,
        didStart,
        didEnd
      };
    },
    reset: () => {
      activeSide = "none";
      activeUntilMs = 0;
    }
  };
}

