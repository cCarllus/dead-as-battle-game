// Responsável por definir estados, input e snapshot canônico da fundação de locomoção de personagem.
export type MovementDirection = "none" | "forward" | "backward" | "left" | "right";

export type CharacterLocomotionState =
  | "Idle"
  | "Walk"
  | "Run"
  | "JumpStart"
  | "InAir"
  | "Fall"
  | "Land"
  | "Crouch"
  | "CrouchWalk"
  | "Slide"
  | "WallRun"
  | "DoubleJump"
  | "Attack"
  | "Block"
  | "Hit"
  | "Stunned"
  | "Dead";

export type WallRunSide = "none" | "left" | "right";

export type CharacterMovementInputState = {
  forward: boolean;
  left: boolean;
  backward: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
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
  isSliding: boolean;
  isWallRunning: boolean;
  wallRunSide: WallRunSide;
  didGroundJump: boolean;
  didDoubleJump: boolean;
  didLand: boolean;
  didCrouchEnter: boolean;
  didCrouchExit: boolean;
  didSlideStart: boolean;
  didSlideEnd: boolean;
  didWallRunStart: boolean;
  didWallRunEnd: boolean;
  speedNormalized: number;
  lateralInput: number;
  forwardInput: number;
  crouchAlpha: number;
  slideAlpha: number;
  verticalVelocity: number;
  landingImpact: number;
  sprintIntent: {
    isShiftPressed: boolean;
    isForwardPressed: boolean;
  };
  cameraProfile: {
    crouchOffsetY: number;
    slideOffsetY: number;
    sprintFovBoostRadians: number;
    wallRunFovBoostRadians: number;
    wallRunTiltRadians: number;
  };
};

