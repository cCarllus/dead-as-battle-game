// Responsável por definir estados, input e snapshot canônico da fundação de locomoção de personagem.
import type { CharacterLocomotionState, WallRunSide } from "@/shared/character-state";

export type MovementDirection = "none" | "forward" | "backward" | "left" | "right";
export type { CharacterLocomotionState, WallRunSide } from "@/shared/character-state";

export type CharacterMovementInputState = {
  forward: boolean;
  left: boolean;
  backward: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  rollPressed: boolean;
  descend: boolean;
};

export type CharacterLocomotionSnapshot = {
  nowMs: number;
  state: CharacterLocomotionState;
  movementDirection: MovementDirection;
  transform: { x: number; y: number; z: number; rotationY: number };
  isGrounded: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isRolling: boolean;
  isWallRunning: boolean;
  wallRunSide: WallRunSide;
  didGroundJump: boolean;
  didDoubleJump: boolean;
  didLand: boolean;
  didCrouchEnter: boolean;
  didCrouchExit: boolean;
  didRollingStart: boolean;
  didRollingEnd: boolean;
  didWallRunStart: boolean;
  didWallRunEnd: boolean;
  speedNormalized: number;
  lateralInput: number;
  forwardInput: number;
  crouchAlpha: number;
  rollingAlpha: number;
  verticalVelocity: number;
  landingImpact: number;
  sprintIntent: {
    isShiftPressed: boolean;
    isForwardPressed: boolean;
  };
};
