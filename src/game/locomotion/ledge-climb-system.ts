// Responsável por interpolar subida de ledge/mantle com start/end travados e deslocamento lógico controlado por código.
import { Vector3 } from "@babylonjs/core";
import type { CharacterLocomotionState } from "./locomotion-state";
import type { LedgeCandidateKind, LedgeGrabCandidate } from "./ledge-detection-system";

export type LedgeClimbStepResult = {
  isClimbing: boolean;
  didFinish: boolean;
  transform: { x: number; y: number; z: number; rotationY: number } | null;
  ledge: LedgeGrabCandidate | null;
  locomotionState: CharacterLocomotionState;
};

export type LedgeClimbSystem = {
  start: (input: {
    ledge: LedgeGrabCandidate;
    nowMs: number;
    durationMs: number;
    startPosition?: Vector3 | null;
    endPosition?: Vector3 | null;
  }) => void;
  step: (input: { nowMs: number }) => LedgeClimbStepResult;
  isActive: () => boolean;
  getLocomotionState: () => CharacterLocomotionState;
  reset: () => void;
};

type ActiveClimb = {
  ledge: LedgeGrabCandidate;
  kind: LedgeCandidateKind;
  locomotionState: CharacterLocomotionState;
  startedAtMs: number;
  durationMs: number;
  startPosition: Vector3;
  endPosition: Vector3;
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

function resolveLocomotionState(kind: LedgeCandidateKind): CharacterLocomotionState {
  return kind === "mantle" ? "MantlingLowObstacle" : "ClimbingUp";
}

export function createLedgeClimbSystem(): LedgeClimbSystem {
  let activeClimb: ActiveClimb | null = null;

  return {
    start: (input) => {
      const startPosition = input.startPosition ?? input.ledge.climbStartPosition;
      const endPosition = input.endPosition ?? input.ledge.climbEndPosition;
      const kind = input.ledge.kind;

      activeClimb = {
        ledge: input.ledge,
        kind,
        locomotionState: resolveLocomotionState(kind),
        startedAtMs: input.nowMs,
        durationMs: Math.max(1, input.durationMs),
        startPosition: startPosition.clone(),
        endPosition: endPosition.clone()
      };
    },
    step: (input) => {
      if (!activeClimb) {
        return {
          isClimbing: false,
          didFinish: false,
          transform: null,
          ledge: null,
          locomotionState: "Idle"
        };
      }

      const elapsedMs = Math.max(0, input.nowMs - activeClimb.startedAtMs);
      const rawAlpha = Math.min(1, elapsedMs / activeClimb.durationMs);
      const easedAlpha = easeInOutCubic(rawAlpha);
      const basePosition = lerpVector(
        activeClimb.startPosition,
        activeClimb.endPosition,
        easedAlpha
      );

      // Pequeno arco vertical evita sensação de "teleporte linear" e melhora leitura visual de subida.
      const arcHeight = activeClimb.kind === "mantle" ? 0.16 : 0.3;
      basePosition.y += Math.sin(easedAlpha * Math.PI) * arcHeight;

      const result: LedgeClimbStepResult = {
        isClimbing: rawAlpha < 1,
        didFinish: rawAlpha >= 1,
        transform: {
          x: basePosition.x,
          y: basePosition.y,
          z: basePosition.z,
          rotationY: activeClimb.ledge.rotationY
        },
        ledge: activeClimb.ledge,
        locomotionState: activeClimb.locomotionState
      };

      if (rawAlpha >= 1) {
        activeClimb = null;
      }

      return result;
    },
    isActive: () => activeClimb !== null,
    getLocomotionState: () => activeClimb?.locomotionState ?? "Idle",
    reset: () => {
      activeClimb = null;
    }
  };
}
