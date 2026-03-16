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

export type CreateCameraTiltSystemOptions = {
  maxTiltRadians?: number;
  inSpeed?: number;
  outSpeed?: number;
};

const DEFAULT_MAX_TILT = (2 * Math.PI) / 180;
const DEFAULT_IN_SPEED = 8;
const DEFAULT_OUT_SPEED = 6.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createCameraTiltSystem(options: CreateCameraTiltSystemOptions = {}): CameraTiltSystem {
  const maxTilt = options.maxTiltRadians ?? DEFAULT_MAX_TILT;
  const inSpeed = options.inSpeed ?? DEFAULT_IN_SPEED;
  const outSpeed = options.outSpeed ?? DEFAULT_OUT_SPEED;
  let currentTilt = 0;

  return {
    update: (input) => {
      const deltaSeconds = Math.max(0, input.deltaSeconds);
      const canTilt = input.isSprinting && input.isGrounded;
      const targetTilt = canTilt ? clamp(input.turnInput, -1, 1) * maxTilt : 0;
      const speed = Math.abs(targetTilt) > Math.abs(currentTilt) ? inSpeed : outSpeed;

      currentTilt += (targetTilt - currentTilt) * Math.min(1, speed * deltaSeconds);
      return currentTilt;
    },
    reset: () => {
      currentTilt = 0;
    }
  };
}
