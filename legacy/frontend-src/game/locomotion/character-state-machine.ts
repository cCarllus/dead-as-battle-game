// Responsável por consolidar sinais de movimento/combate em um estado explícito com rolling e saltos responsivos.
import type { CharacterLocomotionState } from "./locomotion-state";
import { CHARACTER_LOCOMOTION_STATE_MACHINE_CONFIG } from "../config/state-machine.config";

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
  isLedgeHanging: boolean;
  isLedgeClimbing: boolean;
  ledgeClimbMode?: "ledge" | "mantle" | null;
  didGroundJump: boolean;
  didDoubleJump: boolean;
  verticalVelocity: number;
};

export type CharacterStateMachine = {
  resolve: (input: CharacterStateMachineInput) => CharacterLocomotionState;
  reset: () => void;
};

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
        jumpStartUntilMs = input.nowMs + CHARACTER_LOCOMOTION_STATE_MACHINE_CONFIG.jumpStartHoldMs;
      }

      if (input.didDoubleJump) {
        doubleJumpUntilMs = input.nowMs + CHARACTER_LOCOMOTION_STATE_MACHINE_CONFIG.doubleJumpHoldMs;
      }

      if (input.isStunned) {
        lastResolvedState =
          input.nowMs - stunnedStartedAtMs < CHARACTER_LOCOMOTION_STATE_MACHINE_CONFIG.hitHoldMs
            ? "Hit"
            : "Stunned";
        return lastResolvedState;
      }

      if (input.isLedgeClimbing) {
        lastResolvedState = input.ledgeClimbMode === "mantle" ? "MantlingLowObstacle" : "ClimbingUp";
        return lastResolvedState;
      }

      if (input.isLedgeHanging) {
        lastResolvedState = "Hanging";
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
        lastResolvedState = "Jumping";
        return lastResolvedState;
      }

      if (!input.isGrounded) {
        lastResolvedState = input.verticalVelocity < -0.12 ? "Falling" : "InAir";
        return lastResolvedState;
      }

      if (input.isCrouching) {
        lastResolvedState = "Crouch";
        return lastResolvedState;
      }

      if (input.isMoving) {
        lastResolvedState = input.isSprinting ? "Running" : "Walk";
        return lastResolvedState;
      }

      lastResolvedState = "Grounded";
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
