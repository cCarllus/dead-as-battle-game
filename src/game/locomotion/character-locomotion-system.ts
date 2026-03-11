// Responsável por orquestrar motor, salto, crouch, slide, wall run, câmera e áudio em um pipeline único de personagem.
import { Vector3 } from "@babylonjs/core";
import type { AnimationGameplayState } from "../animation/animation-state";
import { resolveAnimationGameplayState } from "../animation/animation-state-machine";
import type { CharacterRuntimeConfig } from "../character/character-config";
import type { CombatHookState } from "../combat/combat-hooks";
import { resolveLandingImpactFromAirTime } from "../effects/landing-impact";
import type { CollisionSystem } from "../systems/collision.system";
import { createCharacterMotor } from "./character-motor";
import { createCharacterStateMachine } from "./character-state-machine";
import { createCrouchSystem } from "./crouch-system";
import { createDoubleJumpSystem } from "./double-jump-system";
import type { GroundedSystem } from "./grounded-system";
import { createJumpSystem } from "./jump-system";
import type {
  CharacterLocomotionSnapshot,
  CharacterMovementInputState,
  MovementDirection
} from "./locomotion-state";
import { createSlideSystem } from "./slide-system";
import type { WallCheckSystem } from "./wall-check-system";
import { createWallRunSystem } from "./wall-run-system";

export type CharacterLocomotionFrameInput = {
  nowMs: number;
  deltaSeconds: number;
  currentTransform: { x: number; y: number; z: number; rotationY: number };
  inputState: CharacterMovementInputState;
  cameraForward: Vector3;
  isInputEnabled: boolean;
  isFlyModeEnabled: boolean;
  canSprint: boolean;
  combat: CombatHookState;
};

export type CharacterLocomotionFrameOutput = {
  transform: { x: number; y: number; z: number; rotationY: number };
  animationState: AnimationGameplayState;
  snapshot: CharacterLocomotionSnapshot;
  isGrounded: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  isSprintBurstActive: boolean;
  didStartSprint: boolean;
  didLand: boolean;
  lateralInput: number;
  forwardInput: number;
  speedFeedback: number;
  landingImpact: number;
};

export type CharacterLocomotionSystem = {
  step: (input: CharacterLocomotionFrameInput) => CharacterLocomotionFrameOutput;
  reset: () => void;
};

export type CreateCharacterLocomotionSystemOptions = {
  runtimeConfig: CharacterRuntimeConfig;
  collisionSystem: CollisionSystem;
  groundedSystem: GroundedSystem;
  wallCheckSystem: WallCheckSystem;
};

function resolveMovementDirectionFromAxes(forwardAxis: number, sideAxis: number): MovementDirection {
  if (forwardAxis === 0 && sideAxis === 0) {
    return "none";
  }

  if (Math.abs(forwardAxis) >= Math.abs(sideAxis)) {
    return forwardAxis >= 0 ? "forward" : "backward";
  }

  return sideAxis >= 0 ? "right" : "left";
}

function resolveDesiredDirection(
  cameraForward: Vector3,
  forwardAxis: number,
  sideAxis: number
): Vector3 {
  const forward = cameraForward.lengthSquared() > 0.0001
    ? cameraForward.normalizeToNew()
    : new Vector3(0, 0, 1);
  const right = new Vector3(forward.z, 0, -forward.x);

  return new Vector3(
    forward.x * forwardAxis + right.x * sideAxis,
    0,
    forward.z * forwardAxis + right.z * sideAxis
  );
}

function resolveForwardFromRotation(rotationY: number): Vector3 {
  return new Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
}

export function createCharacterLocomotionSystem(
  options: CreateCharacterLocomotionSystemOptions
): CharacterLocomotionSystem {
  const locomotionConfig = options.runtimeConfig.locomotion;
  const motor = createCharacterMotor();
  const jumpSystem = createJumpSystem({
    jumpBufferTimeMs: locomotionConfig.jumpBufferTimeMs,
    coyoteTimeMs: locomotionConfig.coyoteTimeMs
  });
  const doubleJumpSystem = createDoubleJumpSystem();
  const crouchSystem = createCrouchSystem();
  const slideSystem = createSlideSystem();
  const wallRunSystem = createWallRunSystem();
  const stateMachine = createCharacterStateMachine();

  let wasJumpPressed = false;
  let wasGrounded = false;
  let wasSprinting = false;
  let airborneTimeMs = 0;
  let sprintBurstUntilMs = 0;

  return {
    step: (input) => {
      const inputEnabled = input.isInputEnabled && input.combat.isAlive && !input.combat.isStunned;
      const movementLocked = input.combat.attackComboIndex > 0 || !input.combat.isAlive || input.combat.isStunned;
      const movementEnabled = inputEnabled && !movementLocked;

      const forwardInput = movementEnabled
        ? (input.inputState.forward ? 1 : 0) - (input.inputState.backward ? 1 : 0)
        : 0;
      const lateralInput = movementEnabled
        ? (input.inputState.right ? 1 : 0) - (input.inputState.left ? 1 : 0)
        : 0;

      const movementDirection = resolveMovementDirectionFromAxes(forwardInput, lateralInput);
      const desiredDirection = resolveDesiredDirection(input.cameraForward, forwardInput, lateralInput);
      const hasDirectionalIntent = desiredDirection.lengthSquared() > 0.0001;
      const fallbackForward = resolveForwardFromRotation(input.currentTransform.rotationY);

      const groundedBefore = options.groundedSystem.detect({
        position: {
          x: input.currentTransform.x,
          y: input.currentTransform.y,
          z: input.currentTransform.z
        },
        wasGrounded
      });

      const jumpPressed = movementEnabled && input.inputState.jump && !input.isFlyModeEnabled;
      const jumpPressedEdge = jumpPressed && !wasJumpPressed;
      wasJumpPressed = jumpPressed;

      if (jumpPressedEdge) {
        jumpSystem.queueJumpPress(input.nowMs);
      }

      jumpSystem.notifyGrounded(input.nowMs, groundedBefore.isGrounded);
      doubleJumpSystem.resetIfGrounded(groundedBefore.isGrounded);

      const canSprint =
        movementEnabled &&
        input.canSprint &&
        input.inputState.sprint &&
        input.inputState.forward &&
        !input.inputState.crouch &&
        movementDirection !== "none";

      const didStartSprint = canSprint && !wasSprinting;
      if (didStartSprint) {
        sprintBurstUntilMs = input.nowMs + locomotionConfig.sprintBurstDurationMs;
      }
      wasSprinting = canSprint;
      const isSprintBurstActive = canSprint && input.nowMs <= sprintBurstUntilMs;
      const sprintMultiplier = isSprintBurstActive ? locomotionConfig.sprintBurstSpeedMultiplier : 1;

      const slideOutput = slideSystem.step({
        nowMs: input.nowMs,
        deltaSeconds: input.deltaSeconds,
        wantsSlide: movementEnabled && input.inputState.crouch,
        canSlide: groundedBefore.isGrounded && canSprint && hasDirectionalIntent,
        currentSpeed: canSprint ? locomotionConfig.runSpeed * sprintMultiplier : locomotionConfig.walkSpeed,
        forwardDirection: hasDirectionalIntent ? desiredDirection.clone() : fallbackForward,
        minSpeed: locomotionConfig.slideMinSpeed,
        initialSpeed: locomotionConfig.slideInitialSpeed,
        durationMs: locomotionConfig.slideDurationMs,
        cooldownMs: locomotionConfig.slideCooldownMs
      });

      const wallCheck = options.wallCheckSystem.detect({
        rotationY: input.currentTransform.rotationY,
        desiredDirection: hasDirectionalIntent ? desiredDirection.clone() : fallbackForward
      });

      const wallRunOutput = wallRunSystem.step({
        nowMs: input.nowMs,
        isGrounded: groundedBefore.isGrounded,
        hasForwardIntent: forwardInput > 0,
        canWallRun: movementEnabled && !slideOutput.isSliding && !input.inputState.crouch,
        desiredDirection: hasDirectionalIntent ? desiredDirection.clone() : fallbackForward,
        verticalVelocity: jumpSystem.getVerticalVelocity(),
        wallCheck,
        durationMs: locomotionConfig.wallRunDurationMs,
        gravityScale: locomotionConfig.wallRunGravityMultiplier,
        minEntryFallSpeed: locomotionConfig.wallRunMinEntryFallSpeed
      });

      let didGroundJump = false;
      let didDoubleJump = false;

      if (!input.isFlyModeEnabled && movementEnabled) {
        if (jumpSystem.consumeGroundJump(input.nowMs)) {
          jumpSystem.setVerticalVelocity(locomotionConfig.jumpVelocity);
          didGroundJump = true;
        } else if (
          jumpPressedEdge &&
          !groundedBefore.isGrounded &&
          !wallRunOutput.isWallRunning &&
          doubleJumpSystem.tryUse()
        ) {
          jumpSystem.setVerticalVelocity(locomotionConfig.doubleJumpVelocity);
          jumpSystem.clearBufferedJump();
          didDoubleJump = true;
        }
      }

      const crouchOutput = crouchSystem.step({
        deltaSeconds: input.deltaSeconds,
        wantsCrouch: movementEnabled && input.inputState.crouch && !slideOutput.isSliding,
        forcedCrouch: slideOutput.forcedCrouch
      });

      const colliderHeight = slideOutput.isSliding
        ? options.runtimeConfig.slideColliderHeight
        : crouchOutput.alpha > 0.05
          ? options.runtimeConfig.colliderHeight +
            (options.runtimeConfig.crouchColliderHeight - options.runtimeConfig.colliderHeight) *
              crouchOutput.alpha
          : options.runtimeConfig.colliderHeight;
      options.collisionSystem.setColliderHeight(colliderHeight, options.runtimeConfig.colliderRadius);

      let desiredSpeed = locomotionConfig.walkSpeed;
      if (crouchOutput.isCrouched) {
        desiredSpeed = locomotionConfig.crouchSpeed;
      } else if (canSprint) {
        desiredSpeed = locomotionConfig.runSpeed * sprintMultiplier;
      }

      const forcedVelocity = wallRunOutput.isWallRunning && wallRunOutput.direction
        ? wallRunOutput.direction.scale(locomotionConfig.wallRunSpeed)
        : slideOutput.isSliding && slideOutput.direction
          ? slideOutput.direction.scale(slideOutput.speed)
          : null;

      const motorOutput = motor.step({
        deltaSeconds: input.deltaSeconds,
        desiredDirection: hasDirectionalIntent ? desiredDirection : Vector3.Zero(),
        desiredSpeed,
        currentRotationY: input.currentTransform.rotationY,
        rotationDirection: wallRunOutput.direction ?? (slideOutput.direction ?? desiredDirection),
        isGrounded: groundedBefore.isGrounded,
        canMove: movementEnabled && !input.isFlyModeEnabled,
        airControl: locomotionConfig.airControl,
        acceleration: groundedBefore.isGrounded ? locomotionConfig.acceleration : locomotionConfig.airAcceleration,
        deceleration: groundedBefore.isGrounded ? locomotionConfig.deceleration : locomotionConfig.airDeceleration,
        forcedVelocity,
        turnSpeedRadians: locomotionConfig.turnSpeedRadians
      });

      let verticalDisplacement = 0;
      let verticalVelocity = 0;

      if (input.isFlyModeEnabled) {
        const verticalAxis = movementEnabled
          ? (input.inputState.jump ? 1 : 0) - (input.inputState.descend ? 1 : 0)
          : 0;
        verticalDisplacement = verticalAxis * locomotionConfig.walkSpeed * input.deltaSeconds;
        jumpSystem.setVerticalVelocity(0);
      } else {
        if (wallRunOutput.isWallRunning && jumpSystem.getVerticalVelocity() < -1.1) {
          jumpSystem.setVerticalVelocity(-1.1);
        }

        const jumpOutput = jumpSystem.integrate({
          deltaSeconds: input.deltaSeconds,
          isGrounded: groundedBefore.isGrounded && !didGroundJump && !didDoubleJump && !wallRunOutput.isWallRunning,
          gravity: locomotionConfig.gravity,
          fallGravityMultiplier: locomotionConfig.fallGravityMultiplier,
          maxFallSpeed: locomotionConfig.maxFallSpeed,
          gravityScale: wallRunOutput.gravityScale
        });

        verticalDisplacement = jumpOutput.verticalDisplacement;
        verticalVelocity = jumpOutput.verticalVelocity;
      }

      const collisionResult = options.collisionSystem.moveAndSlide(
        new Vector3(motorOutput.displacement.x, 0, motorOutput.displacement.z)
      );

      const projectedNextY = input.currentTransform.y + verticalDisplacement;
      const groundedAfter = input.isFlyModeEnabled
        ? {
            isGrounded: false,
            groundY: projectedNextY
          }
        : options.groundedSystem.detect({
            position: {
              x: collisionResult.transform.x,
              y: projectedNextY,
              z: collisionResult.transform.z
            },
            wasGrounded: groundedBefore.isGrounded
          });

      let nextY = projectedNextY;
      if (!input.isFlyModeEnabled && groundedAfter.isGrounded && verticalVelocity <= 0.01) {
        nextY = groundedAfter.groundY + options.runtimeConfig.collisionClearanceY;
        jumpSystem.setVerticalVelocity(0);
        verticalVelocity = 0;
      }

      const didLand = !wasGrounded && groundedAfter.isGrounded && !didGroundJump && !didDoubleJump;
      let landingImpact = 0;
      if (groundedAfter.isGrounded) {
        if (didLand) {
          landingImpact = resolveLandingImpactFromAirTime(airborneTimeMs);
        }
        airborneTimeMs = 0;
      } else {
        airborneTimeMs += input.deltaSeconds * 1000;
      }
      wasGrounded = groundedAfter.isGrounded;

      const transform = {
        x: collisionResult.transform.x,
        y: nextY,
        z: collisionResult.transform.z,
        rotationY: motorOutput.nextRotationY
      };

      const speedCap = Math.max(
        locomotionConfig.runSpeed * locomotionConfig.sprintBurstSpeedMultiplier,
        locomotionConfig.slideInitialSpeed,
        locomotionConfig.wallRunSpeed
      );
      const speedNormalized = speedCap > 0 ? Math.max(0, Math.min(1, motorOutput.speed / speedCap)) : 0;

      const state = stateMachine.resolve({
        nowMs: input.nowMs,
        isAlive: input.combat.isAlive,
        isStunned: input.combat.isStunned,
        isAttacking: input.combat.attackComboIndex > 0,
        isBlocking: input.combat.isBlocking && input.combat.attackComboIndex === 0,
        isGrounded: groundedAfter.isGrounded,
        isMoving: motorOutput.isMoving,
        isSprinting: canSprint,
        isCrouching: crouchOutput.isCrouched,
        isSliding: slideOutput.isSliding,
        isWallRunning: wallRunOutput.isWallRunning,
        didGroundJump,
        didDoubleJump,
        didLand,
        verticalVelocity
      });

      const snapshot: CharacterLocomotionSnapshot = {
        nowMs: input.nowMs,
        state,
        movementDirection,
        transform,
        isGrounded: groundedAfter.isGrounded,
        isMoving: motorOutput.isMoving,
        isSprinting: canSprint,
        isCrouching: crouchOutput.isCrouched,
        isSliding: slideOutput.isSliding,
        isWallRunning: wallRunOutput.isWallRunning,
        wallRunSide: wallRunOutput.side,
        didGroundJump,
        didDoubleJump,
        didLand,
        didCrouchEnter: crouchOutput.didEnter,
        didCrouchExit: crouchOutput.didExit,
        didSlideStart: slideOutput.didStart,
        didSlideEnd: slideOutput.didEnd,
        didWallRunStart: wallRunOutput.didStart,
        didWallRunEnd: wallRunOutput.didEnd,
        speedNormalized,
        lateralInput,
        forwardInput,
        crouchAlpha: crouchOutput.alpha,
        slideAlpha: slideOutput.alpha,
        verticalVelocity,
        landingImpact,
        sprintIntent: {
          isShiftPressed: canSprint,
          isForwardPressed: canSprint && input.inputState.forward
        },
        cameraProfile: {
          crouchOffsetY: locomotionConfig.crouchCameraOffsetY,
          slideOffsetY: locomotionConfig.slideCameraOffsetY,
          sprintFovBoostRadians: locomotionConfig.sprintFovBoostRadians,
          wallRunFovBoostRadians: locomotionConfig.wallRunFovBoostRadians,
          wallRunTiltRadians: locomotionConfig.wallRunTiltRadians
        }
      };

      return {
        transform,
        animationState: resolveAnimationGameplayState({
          snapshot,
          combat: input.combat
        }),
        snapshot,
        isGrounded: groundedAfter.isGrounded,
        isMoving: motorOutput.isMoving,
        isSprinting: canSprint,
        isSprintBurstActive,
        didStartSprint,
        didLand,
        lateralInput,
        forwardInput,
        speedFeedback: speedNormalized,
        landingImpact
      };
    },
    reset: () => {
      motor.reset();
      jumpSystem.reset();
      doubleJumpSystem.reset();
      crouchSystem.reset();
      slideSystem.reset();
      wallRunSystem.reset();
      stateMachine.reset();
      wasJumpPressed = false;
      wasGrounded = false;
      wasSprinting = false;
      airborneTimeMs = 0;
      sprintBurstUntilMs = 0;
    }
  };
}
