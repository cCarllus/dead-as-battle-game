// Responsável por garantir salto confiável com jump buffer, coyote time e gravidade consistente.
import type { PlayerPhysicsConfig } from "../physics/player-physics";

export type JumpFrameInput = {
  deltaSeconds: number;
  nowMs: number;
  isGrounded: boolean;
};

export type JumpFrameOutput = {
  verticalDisplacement: number;
  verticalVelocity: number;
  didStartJump: boolean;
  didLand: boolean;
  isAirborne: boolean;
};

export type JumpController = {
  queueJumpPress: (nowMs: number) => void;
  step: (input: JumpFrameInput) => JumpFrameOutput;
  reset: () => void;
  getVerticalVelocity: () => number;
};

export function createJumpController(config: PlayerPhysicsConfig): JumpController {
  let verticalVelocity = 0;
  let jumpBufferedUntilMs = 0;
  let lastGroundedAtMs = 0;
  let wasGroundedLastFrame = false;

  return {
    queueJumpPress: (nowMs) => {
      jumpBufferedUntilMs = Math.max(jumpBufferedUntilMs, nowMs + config.jumpBufferTimeMs);
    },
    step: (input) => {
      const safeDelta = Math.max(0, input.deltaSeconds);
      const nowMs = input.nowMs;
      let isGrounded = input.isGrounded;
      let didStartJump = false;

      if (isGrounded) {
        lastGroundedAtMs = nowMs;
      }

      const canUseCoyote = nowMs - lastGroundedAtMs <= config.coyoteTimeMs;
      const hasBufferedJump = jumpBufferedUntilMs >= nowMs;
      if (hasBufferedJump && (isGrounded || canUseCoyote)) {
        verticalVelocity = config.jumpVelocity;
        jumpBufferedUntilMs = 0;
        didStartJump = true;
        isGrounded = false;
      }

      if (isGrounded && verticalVelocity < 0) {
        verticalVelocity = 0;
      }

      const shouldApplyGravity = !isGrounded || verticalVelocity > 0;
      if (shouldApplyGravity) {
        const gravityMultiplier = verticalVelocity > 0 ? 1 : config.fallGravityMultiplier;
        verticalVelocity -= config.gravity * gravityMultiplier * safeDelta;
        verticalVelocity = Math.max(-config.maxFallSpeed, verticalVelocity);
      }

      const didLand = !wasGroundedLastFrame && isGrounded && !didStartJump;
      const isAirborne = !isGrounded || verticalVelocity > 0.01;
      wasGroundedLastFrame = isGrounded;

      return {
        verticalDisplacement: verticalVelocity * safeDelta,
        verticalVelocity,
        didStartJump,
        didLand,
        isAirborne
      };
    },
    reset: () => {
      verticalVelocity = 0;
      jumpBufferedUntilMs = 0;
      lastGroundedAtMs = 0;
      wasGroundedLastFrame = false;
    },
    getVerticalVelocity: () => verticalVelocity
  };
}
