// Responsável por aplicar aceleração planar, controle aéreo, rolling e rotação suave em um único motor.
import { Vector3 } from "@babylonjs/core";
import { clamp, moveTowards, normalizeAngleRadians } from "@/utils/math";

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
  setPlanarVelocity: (velocity: Vector3) => void;
  getPlanarVelocity: () => Vector3;
  reset: () => void;
};

export function createCharacterMotor(): CharacterMotor {
  const planarVelocity = Vector3.Zero();

  return {
    step: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);

      if (input.forcedVelocity && input.canMove) {
        planarVelocity.copyFrom(input.forcedVelocity);
      } else {
        const hasDirection = input.desiredDirection.lengthSquared() > 0.0001;
        const normalizedDirection = hasDirection
          ? input.desiredDirection.normalizeToNew()
          : Vector3.Zero();

        if (input.isGrounded) {
          const targetVelocityX = input.canMove ? normalizedDirection.x * input.desiredSpeed : 0;
          const targetVelocityZ = input.canMove ? normalizedDirection.z * input.desiredSpeed : 0;
          planarVelocity.x = moveTowards(planarVelocity.x, targetVelocityX, input.acceleration * safeDelta);
          planarVelocity.z = moveTowards(planarVelocity.z, targetVelocityZ, input.deceleration * safeDelta);
        } else if (input.canMove && hasDirection) {
          const airAcceleration = input.acceleration * clamp(input.airControl, 0, 1) * safeDelta;
          const targetVelocityX = normalizedDirection.x * input.desiredSpeed;
          const targetVelocityZ = normalizedDirection.z * input.desiredSpeed;
          planarVelocity.x = moveTowards(planarVelocity.x, targetVelocityX, airAcceleration);
          planarVelocity.z = moveTowards(planarVelocity.z, targetVelocityZ, airAcceleration);
        } else {
          const airDrag = input.deceleration * 0.18 * safeDelta;
          planarVelocity.x = moveTowards(planarVelocity.x, 0, airDrag);
          planarVelocity.z = moveTowards(planarVelocity.z, 0, airDrag);
        }
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
    setPlanarVelocity: (velocity) => {
      planarVelocity.copyFrom(velocity);
      planarVelocity.y = 0;
    },
    getPlanarVelocity: () => {
      return planarVelocity.clone();
    },
    reset: () => {
      planarVelocity.set(0, 0, 0);
    }
  };
}
