// Responsável por aplicar aceleração planar, controle aéreo, slide/wall run e rotação suave em um único motor.
import { Vector3 } from "@babylonjs/core";

export type CharacterMotorOutput = {
  displacement: Vector3;
  velocity: Vector3;
  nextRotationY: number;
  isMoving: boolean;
  speed: number;
};

export type CharacterMotor = {
  step: (input: {
    deltaSeconds: number;
    desiredDirection: Vector3;
    desiredSpeed: number;
    currentRotationY: number;
    rotationDirection?: Vector3 | null;
    isGrounded: boolean;
    canMove: boolean;
    airControl: number;
    acceleration: number;
    deceleration: number;
    forcedVelocity?: Vector3 | null;
    turnSpeedRadians: number;
  }) => CharacterMotorOutput;
  reset: () => void;
};

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }

  return Math.max(current - maxDelta, target);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

export function createCharacterMotor(): CharacterMotor {
  const planarVelocity = Vector3.Zero();

  return {
    step: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      const controlMultiplier = input.isGrounded ? 1 : input.airControl;

      if (input.forcedVelocity && input.canMove) {
        planarVelocity.copyFrom(input.forcedVelocity);
      } else {
        const hasDirection = input.desiredDirection.lengthSquared() > 0.0001;
        const normalizedDirection = hasDirection
          ? input.desiredDirection.normalizeToNew()
          : Vector3.Zero();
        const targetVelocityX = input.canMove ? normalizedDirection.x * input.desiredSpeed * controlMultiplier : 0;
        const targetVelocityZ = input.canMove ? normalizedDirection.z * input.desiredSpeed * controlMultiplier : 0;

        planarVelocity.x = moveTowards(planarVelocity.x, targetVelocityX, input.acceleration * safeDelta);
        planarVelocity.z = moveTowards(planarVelocity.z, targetVelocityZ, input.deceleration * safeDelta);
      }

      const speed = Math.sqrt(planarVelocity.x * planarVelocity.x + planarVelocity.z * planarVelocity.z);
      const displacement = planarVelocity.scale(safeDelta);
      const isMoving = speed > 0.01;

      let nextRotationY = input.currentRotationY;
      const rotationDirection =
        input.rotationDirection && input.rotationDirection.lengthSquared() > 0.0001
          ? input.rotationDirection.normalizeToNew()
          : input.desiredDirection.lengthSquared() > 0.0001
            ? input.desiredDirection.normalizeToNew()
            : null;

      if (rotationDirection && input.canMove) {
        const targetRotation = Math.atan2(rotationDirection.x, rotationDirection.z);
        const rotationDelta = normalizeAngleRadians(targetRotation - input.currentRotationY);
        const maxRotationStep = input.turnSpeedRadians * safeDelta;
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

