// Responsável por aplicar jump buffer, coyote time e integração vertical reutilizável do personagem.
export type JumpIntegrationResult = {
  verticalDisplacement: number;
  verticalVelocity: number;
  didLand: boolean;
  isAirborne: boolean;
};

export type JumpSystem = {
  queueJumpPress: (nowMs: number) => void;
  notifyGrounded: (nowMs: number, isGrounded: boolean) => void;
  consumeGroundJump: (nowMs: number) => boolean;
  integrate: (input: {
    deltaSeconds: number;
    isGrounded: boolean;
    gravity: number;
    fallGravityMultiplier: number;
    maxFallSpeed: number;
    gravityScale?: number;
  }) => JumpIntegrationResult;
  setVerticalVelocity: (value: number) => void;
  clearBufferedJump: () => void;
  getVerticalVelocity: () => number;
  reset: () => void;
};

export type CreateJumpSystemOptions = {
  jumpBufferTimeMs: number;
  coyoteTimeMs: number;
};

export function createJumpSystem(options: CreateJumpSystemOptions): JumpSystem {
  let verticalVelocity = 0;
  let jumpBufferedUntilMs = 0;
  let lastGroundedAtMs = 0;
  let isGrounded = false;
  let wasGroundedLastFrame = false;

  return {
    queueJumpPress: (nowMs) => {
      jumpBufferedUntilMs = Math.max(jumpBufferedUntilMs, nowMs + options.jumpBufferTimeMs);
    },
    notifyGrounded: (nowMs, nextGrounded) => {
      isGrounded = nextGrounded;
      if (nextGrounded) {
        lastGroundedAtMs = nowMs;
      }
    },
    consumeGroundJump: (nowMs) => {
      const hasBufferedJump = jumpBufferedUntilMs >= nowMs;
      const canUseCoyote = nowMs - lastGroundedAtMs <= options.coyoteTimeMs;
      if (!hasBufferedJump || (!isGrounded && !canUseCoyote)) {
        return false;
      }

      jumpBufferedUntilMs = 0;
      isGrounded = false;
      return true;
    },
    integrate: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      const gravityScale = input.gravityScale ?? 1;

      if (input.isGrounded && verticalVelocity < 0) {
        verticalVelocity = 0;
      }

      const shouldApplyGravity = !input.isGrounded || verticalVelocity > 0;
      if (shouldApplyGravity) {
        const gravityMultiplier = verticalVelocity > 0 ? 1 : input.fallGravityMultiplier;
        verticalVelocity -= input.gravity * gravityMultiplier * gravityScale * safeDelta;
        verticalVelocity = Math.max(-input.maxFallSpeed, verticalVelocity);
      }

      const didLand = !wasGroundedLastFrame && input.isGrounded;
      const isAirborne = !input.isGrounded || Math.abs(verticalVelocity) > 0.01;
      wasGroundedLastFrame = input.isGrounded;

      return {
        verticalDisplacement: verticalVelocity * safeDelta,
        verticalVelocity,
        didLand,
        isAirborne
      };
    },
    setVerticalVelocity: (value) => {
      verticalVelocity = value;
      wasGroundedLastFrame = false;
    },
    clearBufferedJump: () => {
      jumpBufferedUntilMs = 0;
    },
    getVerticalVelocity: () => verticalVelocity,
    reset: () => {
      verticalVelocity = 0;
      jumpBufferedUntilMs = 0;
      lastGroundedAtMs = 0;
      isGrounded = false;
      wasGroundedLastFrame = false;
    }
  };
}

