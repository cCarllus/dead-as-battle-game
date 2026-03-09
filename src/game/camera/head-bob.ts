// Responsável por calcular head bob suave para caminhada e corrida, reforçando peso de movimento.
export type HeadBobInput = {
  deltaSeconds: number;
  isGrounded: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  speedNormalized: number;
};

export type HeadBobSystem = {
  update: (input: HeadBobInput) => number;
  reset: () => void;
};

const WALK_BOB_AMPLITUDE = 0.014;
const RUN_BOB_AMPLITUDE = 0.027;
const WALK_BOB_FREQUENCY_HZ = 5.8;
const RUN_BOB_FREQUENCY_HZ = 8.8;
const RETURN_SPEED = 8;

export function createHeadBobSystem(): HeadBobSystem {
  let phase = 0;
  let currentOffset = 0;

  return {
    update: (input) => {
      const deltaSeconds = Math.max(0, input.deltaSeconds);
      const shouldBob = input.isGrounded && input.isMoving;

      if (!shouldBob) {
        currentOffset += (0 - currentOffset) * Math.min(1, RETURN_SPEED * deltaSeconds);
        return currentOffset;
      }

      const amplitude = input.isSprinting ? RUN_BOB_AMPLITUDE : WALK_BOB_AMPLITUDE;
      const frequency = input.isSprinting ? RUN_BOB_FREQUENCY_HZ : WALK_BOB_FREQUENCY_HZ;
      const speedFactor = Math.max(0.35, Math.min(1.3, input.speedNormalized));

      phase += deltaSeconds * frequency * Math.PI * 2 * speedFactor;
      const targetOffset = Math.sin(phase) * amplitude;
      currentOffset += (targetOffset - currentOffset) * Math.min(1, 12 * deltaSeconds);

      return currentOffset;
    },
    reset: () => {
      phase = 0;
      currentOffset = 0;
    }
  };
}
