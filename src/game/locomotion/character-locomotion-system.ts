// Responsável por orquestrar motor, salto, crouch, rolling, câmera e áudio em um pipeline único de personagem.
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
import { createRollingSystem } from "./rolling-system";

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
  const rollingSystem = createRollingSystem();
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

      const rollingOutput = rollingSystem.step({
        nowMs: input.nowMs,
        deltaSeconds: input.deltaSeconds,
        wantsRolling: movementEnabled && input.inputState.rollPressed,
        canRoll: groundedBefore.isGrounded && canSprint && hasDirectionalIntent,
        currentSpeed: canSprint ? locomotionConfig.runSpeed * sprintMultiplier : locomotionConfig.walkSpeed,
        forwardDirection: hasDirectionalIntent ? desiredDirection.clone() : fallbackForward,
        minSpeed: locomotionConfig.rollingMinSpeed,
        initialSpeed: locomotionConfig.rollingInitialSpeed,
        durationMs: locomotionConfig.rollingDurationMs,
        cooldownMs: locomotionConfig.rollingCooldownMs
      });

      const wantsStationaryCrouch =
        movementEnabled &&
        input.inputState.crouch &&
        !rollingOutput.isRolling &&
        !hasDirectionalIntent;

      let didGroundJump = false;
      let didDoubleJump = false;

      if (!input.isFlyModeEnabled && movementEnabled) {
        if (jumpSystem.consumeGroundJump(input.nowMs)) {
          jumpSystem.setVerticalVelocity(locomotionConfig.jumpVelocity);
          didGroundJump = true;
        } else if (
          jumpPressedEdge &&
          !groundedBefore.isGrounded &&
          doubleJumpSystem.tryUse()
        ) {
          jumpSystem.setVerticalVelocity(locomotionConfig.doubleJumpVelocity);
          jumpSystem.clearBufferedJump();
          didDoubleJump = true;
        }
      }

      const crouchOutput = crouchSystem.step({
        deltaSeconds: input.deltaSeconds,
        wantsCrouch: wantsStationaryCrouch,
        forcedCrouch: rollingOutput.forcesCompactCollider
      });
      const isCrouchStateActive =
        crouchOutput.isCrouched && wantsStationaryCrouch && !rollingOutput.forcesCompactCollider;

      const colliderHeight = rollingOutput.isRolling
        ? options.runtimeConfig.rollingColliderHeight
        : crouchOutput.alpha > 0.05
          ? options.runtimeConfig.colliderHeight +
            (options.runtimeConfig.crouchColliderHeight - options.runtimeConfig.colliderHeight) *
              crouchOutput.alpha
          : options.runtimeConfig.colliderHeight;
      options.collisionSystem.setColliderHeight(colliderHeight, options.runtimeConfig.colliderRadius);

      let desiredSpeed = locomotionConfig.walkSpeed;
      if (isCrouchStateActive) {
        desiredSpeed = locomotionConfig.crouchSpeed;
      } else if (canSprint) {
        desiredSpeed = locomotionConfig.runSpeed * sprintMultiplier;
      }

      const forcedVelocity = rollingOutput.isRolling && rollingOutput.direction
        ? rollingOutput.direction.scale(rollingOutput.speed)
        : null;

      const motorOutput = motor.step({
        deltaSeconds: input.deltaSeconds,
        desiredDirection: hasDirectionalIntent ? desiredDirection : Vector3.Zero(),
        desiredSpeed,
        currentRotationY: input.currentTransform.rotationY,
        rotationDirection: rollingOutput.direction ?? desiredDirection,
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
        const jumpOutput = jumpSystem.integrate({
          deltaSeconds: input.deltaSeconds,
          isGrounded: groundedBefore.isGrounded && !didGroundJump && !didDoubleJump,
          gravity: locomotionConfig.gravity,
          fallGravityMultiplier: locomotionConfig.fallGravityMultiplier,
          maxFallSpeed: locomotionConfig.maxFallSpeed,
          gravityScale: 1
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
            groundY: projectedNextY,
            distanceToGround: Number.POSITIVE_INFINITY,
            slopeAngleDegrees: 90,
            groundNormal: null,
            hitMesh: null
          }
        : options.groundedSystem.detect({
            position: {
              x: collisionResult.transform.x,
              y: projectedNextY,
              z: collisionResult.transform.z
            },
            wasGrounded: groundedBefore.isGrounded
          });
      const shouldSnapToGround =
        !input.isFlyModeEnabled &&
        !!groundedAfter.hitMesh &&
        verticalVelocity <= 0 &&
        projectedNextY <=
          groundedAfter.groundY +
            Math.max(
              options.runtimeConfig.collisionClearanceY,
              options.runtimeConfig.locomotion.groundedStickDistance
            );
      const isGroundedResolved = groundedAfter.isGrounded || shouldSnapToGround;

      let nextY = projectedNextY;
      if (!input.isFlyModeEnabled && isGroundedResolved && verticalVelocity <= 0.01) {
        nextY = groundedAfter.groundY + options.runtimeConfig.collisionClearanceY;
        jumpSystem.setVerticalVelocity(0);
        verticalVelocity = 0;
      }

      const didLand = !wasGrounded && isGroundedResolved && !didGroundJump && !didDoubleJump;
      let landingImpact = 0;
      if (isGroundedResolved) {
        if (didLand) {
          landingImpact = resolveLandingImpactFromAirTime(airborneTimeMs);
        }
        airborneTimeMs = 0;
      } else {
        airborneTimeMs += input.deltaSeconds * 1000;
      }
      wasGrounded = isGroundedResolved;

      const transform = {
        x: collisionResult.transform.x,
        y: nextY,
        z: collisionResult.transform.z,
        rotationY: motorOutput.nextRotationY
      };

      const speedCap = Math.max(
        locomotionConfig.runSpeed * locomotionConfig.sprintBurstSpeedMultiplier,
        locomotionConfig.rollingInitialSpeed
      );
      const speedNormalized = speedCap > 0 ? Math.max(0, Math.min(1, motorOutput.speed / speedCap)) : 0;

      const state = stateMachine.resolve({
        nowMs: input.nowMs,
        isAlive: input.combat.isAlive,
        isStunned: input.combat.isStunned,
        isAttacking: input.combat.attackComboIndex > 0,
        isBlocking: input.combat.isBlocking && input.combat.attackComboIndex === 0,
        isGrounded: isGroundedResolved,
        isMoving: motorOutput.isMoving,
        isSprinting: canSprint,
        isCrouching: isCrouchStateActive,
        isRolling: rollingOutput.isRolling,
        didGroundJump,
        didDoubleJump,
        verticalVelocity
      });

      const snapshot: CharacterLocomotionSnapshot = {
        nowMs: input.nowMs,
        state,
        movementDirection,
        transform,
        isGrounded: isGroundedResolved,
        isMoving: motorOutput.isMoving,
        isSprinting: canSprint,
        isCrouching: isCrouchStateActive,
        isRolling: rollingOutput.isRolling,
        isWallRunning: false,
        wallRunSide: "none",
        didGroundJump,
        didDoubleJump,
        didLand,
        didCrouchEnter: crouchOutput.didEnter,
        didCrouchExit: crouchOutput.didExit,
        didRollingStart: rollingOutput.didStart,
        didRollingEnd: rollingOutput.didEnd,
        didWallRunStart: false,
        didWallRunEnd: false,
        speedNormalized,
        lateralInput,
        forwardInput,
        crouchAlpha: crouchOutput.alpha,
        rollingAlpha: rollingOutput.alpha,
        verticalVelocity,
        landingImpact,
        sprintIntent: {
          isShiftPressed: canSprint,
          isForwardPressed: canSprint && input.inputState.forward
        },
        cameraProfile: {
          crouchOffsetY: locomotionConfig.crouchCameraOffsetY,
          rollingOffsetY: locomotionConfig.rollingCameraOffsetY,
          sprintFovBoostRadians: locomotionConfig.sprintFovBoostRadians,
          wallRunFovBoostRadians: 0,
          wallRunTiltRadians: 0
        }
      };

      return {
        transform,
        animationState: resolveAnimationGameplayState({
          snapshot,
          combat: input.combat
        }),
        snapshot,
        isGrounded: isGroundedResolved,
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
      rollingSystem.reset();
      stateMachine.reset();
      wasJumpPressed = false;
      wasGrounded = false;
      wasSprinting = false;
      airborneTimeMs = 0;
      sprintBurstUntilMs = 0;
    }
  };
}
