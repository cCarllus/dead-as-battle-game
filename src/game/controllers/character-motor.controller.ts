// Responsável por aplicar aceleração/desaceleração e rotação suave ao movimento horizontal do jogador.
import { Vector3 } from "@babylonjs/core";
import type { PlayerPhysicsConfig } from "../physics/player-physics";

export type CharacterMotorFrameInput = {
  deltaSeconds: number;
  desiredWorldDirection: Vector3;
  currentRotationY: number;
  isGrounded: boolean;
  wantsSprint: boolean;
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

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }

  return Math.max(current - maxDelta, target);
}

function normalizeAngleRadians(angle: number): number {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized > Math.PI) {
    normalized -= tau;
  }
  if (normalized < -Math.PI) {
    normalized += tau;
  }
  return normalized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createCharacterMotorController(config: PlayerPhysicsConfig): CharacterMotorController {
  const planarVelocity = Vector3.Zero();

  return {
    step: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      const hasDirection = input.desiredWorldDirection.lengthSquared() > 0.000001;
      const normalizedDirection = hasDirection
        ? input.desiredWorldDirection.normalizeToNew()
        : Vector3.Zero();

      const targetSpeed = !input.canMove
        ? 0
        : input.wantsSprint
          ? config.runSpeed
          : config.walkSpeed;

      const targetVelocityX = normalizedDirection.x * targetSpeed;
      const targetVelocityZ = normalizedDirection.z * targetSpeed;

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
