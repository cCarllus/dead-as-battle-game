// Responsável por aplicar aceleração/desaceleração e rotação suave ao movimento horizontal do jogador.
import { Vector3 } from "@babylonjs/core";
import type { PlayerPhysicsConfig } from "../physics/player-physics";
import { resolveAirControlMultiplier } from "../locomotion/air-control";
import { clamp, moveTowards, normalizeAngleRadians } from "@/utils/math";

export type CharacterMotorFrameInput = {
  deltaSeconds: number;
  desiredWorldDirection: Vector3;
  currentRotationY: number;
  isGrounded: boolean;
  wantsSprint: boolean;
  sprintBoostMultiplier?: number;
  canMove: boolean;
};

export type CharacterMotorFrameOutput = {
  displacement: Vector3;
  velocity: Vector3;
  nextRotationY: number;
  isMoving: boolean;
  speed: number;
};

export type CharacterMotorController = {
  step: (input: CharacterMotorFrameInput) => CharacterMotorFrameOutput;
  reset: () => void;
};

export function createCharacterMotorController(config: PlayerPhysicsConfig): CharacterMotorController {
  const planarVelocity = Vector3.Zero();

  return {
    step: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      const hasDirection = input.desiredWorldDirection.lengthSquared() > 0.000001;
      const normalizedDirection = hasDirection
        ? input.desiredWorldDirection.normalizeToNew()
        : Vector3.Zero();

      const sprintBoostMultiplier = input.sprintBoostMultiplier ?? 1;
      const targetSpeed = !input.canMove
        ? 0
        : input.wantsSprint
          ? config.runSpeed * sprintBoostMultiplier
          : config.walkSpeed;
      const controlMultiplier = resolveAirControlMultiplier(input.isGrounded, config.airControl);

      const targetVelocityX = normalizedDirection.x * targetSpeed * controlMultiplier;
      const targetVelocityZ = normalizedDirection.z * targetSpeed * controlMultiplier;

      const acceleration = input.isGrounded ? config.acceleration : config.airAcceleration;
      const deceleration = input.isGrounded ? config.deceleration : config.airDeceleration;

      const nextVelocityX =
        Math.abs(targetVelocityX) > Math.abs(planarVelocity.x)
          ? moveTowards(planarVelocity.x, targetVelocityX, acceleration * safeDelta)
          : moveTowards(planarVelocity.x, targetVelocityX, deceleration * safeDelta);
      const nextVelocityZ =
        Math.abs(targetVelocityZ) > Math.abs(planarVelocity.z)
          ? moveTowards(planarVelocity.z, targetVelocityZ, acceleration * safeDelta)
          : moveTowards(planarVelocity.z, targetVelocityZ, deceleration * safeDelta);

      planarVelocity.x = nextVelocityX;
      planarVelocity.y = 0;
      planarVelocity.z = nextVelocityZ;

      const displacement = planarVelocity.scale(safeDelta);
      const speed = Math.sqrt(planarVelocity.x * planarVelocity.x + planarVelocity.z * planarVelocity.z);
      const isMoving = speed > 0.01;

      let nextRotationY = input.currentRotationY;
      if (hasDirection && input.canMove) {
        const targetRotation = Math.atan2(normalizedDirection.x, normalizedDirection.z);
        const rotationDelta = normalizeAngleRadians(targetRotation - input.currentRotationY);
        const maxRotationStep = config.turnSpeedRadians * safeDelta;
        nextRotationY = input.currentRotationY + clamp(rotationDelta, -maxRotationStep, maxRotationStep);
      }

      return {
        displacement,
        velocity: planarVelocity.clone(),
        nextRotationY,
        isMoving,
        speed
      };
    },
    reset: () => {
      planarVelocity.set(0, 0, 0);
    }
  };
}
