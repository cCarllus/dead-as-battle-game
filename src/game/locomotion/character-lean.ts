// Responsável por aplicar lean lateral suave no personagem local para reforçar leitura de mudança de direção.
import type { TransformNode } from "@babylonjs/core";
import { clamp } from "../utils/math";

export type CharacterLeanInput = {
  deltaSeconds: number;
  isGrounded: boolean;
  isSprinting: boolean;
  lateralInput: number;
  movementIntensity: number;
};

export type CharacterLeanSystem = {
  update: (visualRoot: TransformNode, input: CharacterLeanInput) => void;
  reset: (visualRoot: TransformNode | null) => void;
};

const MAX_LEAN_RADIANS = 0.12;
const LEAN_IN_SPEED = 9;
const LEAN_OUT_SPEED = 7;

export function createCharacterLeanSystem(): CharacterLeanSystem {
  let currentLean = 0;

  return {
    update: (visualRoot, input) => {
      const deltaSeconds = Math.max(0, input.deltaSeconds);
      const canLean = input.isGrounded && input.isSprinting;
      const targetLean = canLean
        ? clamp(input.lateralInput, -1, 1) * MAX_LEAN_RADIANS * Math.max(0, Math.min(1, input.movementIntensity))
        : 0;
      const speed = Math.abs(targetLean) > Math.abs(currentLean) ? LEAN_IN_SPEED : LEAN_OUT_SPEED;

      currentLean += (targetLean - currentLean) * Math.min(1, speed * deltaSeconds);
      visualRoot.rotation.z = currentLean;
    },
    reset: (visualRoot) => {
      currentLean = 0;
      if (visualRoot) {
        visualRoot.rotation.z = 0;
      }
    }
  };
}
