// Responsável por consolidar sinais de movimento/combate em um estado explícito e legível de personagem.
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
  isSliding: boolean;
  isWallRunning: boolean;
  didGroundJump: boolean;
  didDoubleJump: boolean;
  didLand: boolean;
  verticalVelocity: number;
};

export type CharacterStateMachine = {
  resolve: (input: CharacterStateMachineInput) => CharacterLocomotionState;
  reset: () => void;
};

const JUMP_START_HOLD_MS = 140;
const DOUBLE_JUMP_HOLD_MS = 180;
const LAND_HOLD_MS = 130;
const HIT_HOLD_MS = 220;

export function createCharacterStateMachine(): CharacterStateMachine {
  let jumpStartUntilMs = 0;
  let doubleJumpUntilMs = 0;
  let landUntilMs = 0;
  let stunnedStartedAtMs = 0;
  let wasStunned = false;

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

      if (input.didLand) {
        landUntilMs = input.nowMs + LAND_HOLD_MS;
      }

      if (input.isStunned) {
        return input.nowMs - stunnedStartedAtMs < HIT_HOLD_MS ? "Hit" : "Stunned";
      }

      if (input.isAttacking) {
        return "Attack";
      }

      if (input.isBlocking) {
        return "Block";
      }

      if (input.isSliding) {
        return "Slide";
      }

      if (input.isWallRunning) {
        return "WallRun";
      }

      if (input.nowMs < doubleJumpUntilMs) {
        return "DoubleJump";
      }

      if (!input.isGrounded && input.nowMs < jumpStartUntilMs) {
        return "JumpStart";
      }

      if (!input.isGrounded) {
        return input.verticalVelocity < -0.4 ? "Fall" : "InAir";
      }

      if (input.nowMs < landUntilMs) {
        return "Land";
      }

      if (input.isCrouching) {
        return input.isMoving ? "CrouchWalk" : "Crouch";
      }

      if (input.isMoving) {
        return input.isSprinting ? "Run" : "Walk";
      }

      return "Idle";
    },
    reset: () => {
      jumpStartUntilMs = 0;
      doubleJumpUntilMs = 0;
      landUntilMs = 0;
      stunnedStartedAtMs = 0;
      wasStunned = false;
    }
  };
}
