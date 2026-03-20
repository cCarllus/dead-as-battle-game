// Responsável por suavizar entrada/saída de crouch e expor alpha contínuo para collider/câmera/animação.
export type CrouchStepResult = {
  alpha: number;
  isCrouched: boolean;
  didEnter: boolean;
  didExit: boolean;
};

export type CrouchSystem = {
  step: (input: { deltaSeconds: number; wantsCrouch: boolean; forcedCrouch: boolean }) => CrouchStepResult;
  reset: () => void;
};

const CROUCH_BLEND_SPEED = 9.5;

export function createCrouchSystem(): CrouchSystem {
  let alpha = 0;
  let wasCrouched = false;

  return {
    step: (input) => {
      const target = input.wantsCrouch || input.forcedCrouch ? 1 : 0;
      const blendFactor = Math.min(1, Math.max(0, input.deltaSeconds * CROUCH_BLEND_SPEED));
      alpha += (target - alpha) * blendFactor;
      if (Math.abs(target - alpha) < 0.001) {
        alpha = target;
      }

      const isCrouched = alpha >= 0.65;
      const didEnter = !wasCrouched && isCrouched;
      const didExit = wasCrouched && !isCrouched;
      wasCrouched = isCrouched;

      return {
        alpha,
        isCrouched,
        didEnter,
        didExit
      };
    },
    reset: () => {
      alpha = 0;
      wasCrouched = false;
    }
  };
}

