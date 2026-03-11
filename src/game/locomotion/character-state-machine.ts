// Responsável por consolidar sinais de movimento/combate em um estado explícito com rolling e saltos responsivos.
import type { CharacterLocomotionState } from "./locomotion-state";

export type CharacterStateMachineInput = {
  nowMs: number;
  isAlive: boolean;
  isStunned: boolean;
  isAttacking: boolean;
  isBlocking: boolean;
  isGrounded: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isRolling: boolean;
  didGroundJump: boolean;
  didDoubleJump: boolean;
  verticalVelocity: number;
};

export type CharacterStateMachine = {
  resolve: (input: CharacterStateMachineInput) => CharacterLocomotionState;
  reset: () => void;
};

const JUMP_START_HOLD_MS = 140;
const DOUBLE_JUMP_HOLD_MS = 180;
const HIT_HOLD_MS = 220;

export function createCharacterStateMachine(): CharacterStateMachine {
  let jumpStartUntilMs = 0;
  let doubleJumpUntilMs = 0;
  let stunnedStartedAtMs = 0;
  let wasStunned = false;
  let lastResolvedState: CharacterLocomotionState = "Idle";

  return {
    resolve: (input) => {
      if (!input.isAlive) {
        return "Dead";
      }

      if (input.isStunned && !wasStunned) {
        stunnedStartedAtMs = input.nowMs;
      }
      wasStunned = input.isStunned;

      if (input.didGroundJump) {
        jumpStartUntilMs = input.nowMs + JUMP_START_HOLD_MS;
      }

      if (input.didDoubleJump) {
        doubleJumpUntilMs = input.nowMs + DOUBLE_JUMP_HOLD_MS;
      }

      if (input.isStunned) {
        lastResolvedState = input.nowMs - stunnedStartedAtMs < HIT_HOLD_MS ? "Hit" : "Stunned";
        return lastResolvedState;
      }

      if (input.isAttacking) {
        lastResolvedState = "Attack";
        return lastResolvedState;
      }

      if (input.isBlocking) {
        lastResolvedState = "Block";
        return lastResolvedState;
      }

      if (input.isRolling) {
        lastResolvedState = "Rolling";
        return lastResolvedState;
      }

      if (input.nowMs < doubleJumpUntilMs) {
        lastResolvedState = "DoubleJump";
        return lastResolvedState;
      }

      if (!input.isGrounded && input.nowMs < jumpStartUntilMs) {
        lastResolvedState = "JumpStart";
        return lastResolvedState;
      }

      if (!input.isGrounded) {
        lastResolvedState = "InAir";
        return lastResolvedState;
      }

      if (input.isCrouching) {
        lastResolvedState = "Crouch";
        return lastResolvedState;
      }

      if (input.isMoving) {
        lastResolvedState = input.isSprinting ? "Run" : "Walk";
        return lastResolvedState;
      }

      lastResolvedState = "Idle";
      return lastResolvedState;
    },
    reset: () => {
      jumpStartUntilMs = 0;
      doubleJumpUntilMs = 0;
      stunnedStartedAtMs = 0;
      wasStunned = false;
      lastResolvedState = "Idle";
    }
  };
}
