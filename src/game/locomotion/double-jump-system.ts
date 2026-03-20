// Responsável por controlar a única carga extra de double jump e resetá-la ao tocar o chão.
export type DoubleJumpSystem = {
  resetIfGrounded: (isGrounded: boolean) => void;
  tryUse: () => boolean;
  reset: () => void;
};

export function createDoubleJumpSystem(): DoubleJumpSystem {
  let hasConsumedAirJump = false;

  return {
    resetIfGrounded: (isGrounded) => {
      if (isGrounded) {
        hasConsumedAirJump = false;
      }
    },
    tryUse: () => {
      if (hasConsumedAirJump) {
        return false;
      }

      hasConsumedAirJump = true;
      return true;
    },
    reset: () => {
      hasConsumedAirJump = false;
    }
  };
}

