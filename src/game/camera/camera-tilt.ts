// Responsável por gerar inclinação lateral sutil da câmera ao virar/correr para reforçar sensação cinemática.
export type CameraTiltInput = {
  deltaSeconds: number;
  turnInput: number;
  isSprinting: boolean;
  isGrounded: boolean;
};

export type CameraTiltSystem = {
  update: (input: CameraTiltInput) => number;
  reset: () => void;
};

const MAX_TILT = 0.58;
const IN_SPEED = 8;
const OUT_SPEED = 6.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createCameraTiltSystem(): CameraTiltSystem {
  let currentTilt = 0;

  return {
    update: (input) => {
      const deltaSeconds = Math.max(0, input.deltaSeconds);
      const canTilt = input.isSprinting && input.isGrounded;
      const targetTilt = canTilt ? clamp(input.turnInput, -1, 1) * MAX_TILT : 0;
      const speed = Math.abs(targetTilt) > Math.abs(currentTilt) ? IN_SPEED : OUT_SPEED;

      currentTilt += (targetTilt - currentTilt) * Math.min(1, speed * deltaSeconds);
      return currentTilt;
    },
    reset: () => {
      currentTilt = 0;
    }
  };
}
