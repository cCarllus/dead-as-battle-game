// Responsável por orquestrar locomoção avançada (jump/roll/hang/climb/mantle) com física previsível e snap estável.
import { Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { AnimationGameplayState } from "../animation/animation-state";
import { resolveAnimationGameplayState } from "../animation/animation-state-machine";
import type { CharacterRuntimeConfig } from "../character/character-config";
import { interpolateColliderProfile } from "../character/character-collider-config";
import {
  isCombatMovementLocked,
  type CombatHookState
} from "../combat/combat-hooks";
import { resolveLandingImpactFromAirTime } from "../effects/landing-impact";
import type { ShapeQueryService } from "../physics/shape-query-service";
import type { CollisionSystem } from "../systems/collision.system";
import { createCharacterMotor } from "./character-motor";
import { createCharacterStateMachine } from "./character-state-machine";
import { createCrouchSystem } from "./crouch-system";
import { createDoubleJumpSystem } from "./double-jump-system";
import type { GroundedSystem } from "./grounded-system";
import { createJumpSystem } from "./jump-system";
import { createLedgeClimbSystem } from "./ledge-climb-system";
import { createLedgeDebug } from "./ledge-debug";
import { createLedgeDetectionSystem, type LedgeGrabCandidate } from "./ledge-detection-system";
import { createLedgeHangSystem } from "./ledge-hang-system";
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
  dispose: () => void;
};

export type CreateCharacterLocomotionSystemOptions = {
  scene: Scene;
  runtimeConfig: CharacterRuntimeConfig;
  collisionSystem: CollisionSystem;
  groundedSystem: GroundedSystem;
  isEnvironmentMesh: (mesh: AbstractMesh) => boolean;
  isClimbableMesh: (mesh: AbstractMesh) => boolean;
  shapeQueryService?: ShapeQueryService;
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

function projectMovementOnGround(displacement: Vector3, groundNormal: Vector3 | null): Vector3 {
  if (!groundNormal || groundNormal.lengthSquared() <= 0.0001) {
    return displacement.clone();
  }

  const normal = groundNormal.normalizeToNew();
  const projection = displacement.subtract(normal.scale(Vector3.Dot(displacement, normal)));
  if (projection.lengthSquared() <= 0.0000001) {
    return Vector3.Zero();
  }

  return projection;
}

function applyRunJumpImpulse(input: {
  currentVelocity: Vector3;
  forwardDirection: Vector3;
  isSprinting: boolean;
  runtimeConfig: CharacterRuntimeConfig;
}): Vector3 {
  const boost = input.isSprinting
    ? input.runtimeConfig.locomotion.runJumpForwardBoost
    : input.runtimeConfig.locomotion.normalJumpForwardBoost;
  if (boost <= 0) {
    return input.currentVelocity.clone();
  }

  const forward = input.forwardDirection.lengthSquared() > 0.0001
    ? input.forwardDirection.normalizeToNew()
    : new Vector3(0, 0, 1);
  const next = input.currentVelocity.clone();
  next.x += forward.x * boost;
  next.z += forward.z * boost;
  return next;
}

export function createCharacterLocomotionSystem(
  options: CreateCharacterLocomotionSystemOptions
): CharacterLocomotionSystem {
  const runtimeConfig = options.runtimeConfig;
  const locomotionConfig = runtimeConfig.locomotion;
  const ledgeConfig = runtimeConfig.ledge;
  const motor = createCharacterMotor();
  const jumpSystem = createJumpSystem({
    jumpBufferTimeMs: locomotionConfig.jumpBufferTimeMs,
    coyoteTimeMs: locomotionConfig.coyoteTimeMs
  });
  const doubleJumpSystem = createDoubleJumpSystem();
  const crouchSystem = createCrouchSystem();
  const rollingSystem = createRollingSystem();
  const stateMachine = createCharacterStateMachine();
  const ledgeDetectionSystem = createLedgeDetectionSystem({
    scene: options.scene,
    runtimeConfig,
    groundedSystem: options.groundedSystem,
    isEnvironmentMesh: options.isEnvironmentMesh,
    isClimbableMesh: options.isClimbableMesh,
    shapeQueryService: options.shapeQueryService
  });
  const ledgeDebug = createLedgeDebug(options.scene);
  const ledgeHangSystem = createLedgeHangSystem(ledgeConfig);
  const ledgeClimbSystem = createLedgeClimbSystem();

  let wasJumpPressed = false;
  let wasGrounded = false;
  let wasSprinting = false;
  let airborneTimeMs = 0;
  let sprintBurstUntilMs = 0;
  let lastDetectionRejectLogAtMs = 0;

  const restoreDefaultCollider = (): void => {
    options.collisionSystem.setColliderProfile("default");
  };

  const updateColliderForState = (input: {
    isRolling: boolean;
    crouchAlpha: number;
  }): void => {
    if (input.isRolling) {
      options.collisionSystem.setColliderProfile("rolling");
      return;
    }

    if (input.crouchAlpha > 0.05) {
      options.collisionSystem.setColliderProfile("default");
      const crouchedProfile = interpolateColliderProfile(
        runtimeConfig.collider.standing,
        runtimeConfig.collider.crouch,
        input.crouchAlpha
      );
      options.collisionSystem.setColliderHeight(
        crouchedProfile.height,
        crouchedProfile.radius,
        crouchedProfile.centerY
      );
      return;
    }

    restoreDefaultCollider();
  };

  const renderLedgeDebug = (
    candidate: LedgeGrabCandidate | null,
    rootTransform:
      | CharacterLocomotionFrameInput["currentTransform"]
      | CharacterLocomotionFrameOutput["transform"]
      | null,
    state: CharacterLocomotionSnapshot["state"],
    velocity: Vector3,
    verticalVelocity: number,
    isGrounded: boolean,
    slopeAngleDegrees: number | null,
    attempt: ReturnType<typeof ledgeDetectionSystem.getLastAttempt> | null = null
  ): void => {
    if (!candidate && !attempt) {
      ledgeDebug.render(null);
      return;
    }

    const collisionDebugState = options.collisionSystem.getDebugState();
    const characterRootPosition = rootTransform
      ? new Vector3(rootTransform.x, rootTransform.y, rootTransform.z)
      : collisionDebugState.gameplayRootPosition.clone();
    const colliderCenterPosition = characterRootPosition.add(collisionDebugState.ellipsoidOffset);

    ledgeDebug.render({
      candidate,
      probes: attempt?.probes ?? [],
      attemptReason: attempt?.reason ?? null,
      attemptKind: attempt?.kind ?? null,
      characterRootPosition,
      colliderCenterPosition,
      state,
      velocity,
      verticalVelocity,
      isGrounded,
      slopeAngleDegrees
    });
  };

  const logLedgeDebug = (
    label: string,
    candidate: LedgeGrabCandidate | null,
    rootTransform:
      | CharacterLocomotionFrameInput["currentTransform"]
      | CharacterLocomotionFrameOutput["transform"]
      | null,
    state: CharacterLocomotionSnapshot["state"],
    velocity: Vector3,
    verticalVelocity: number,
    isGrounded: boolean,
    slopeAngleDegrees: number | null,
    attempt: ReturnType<typeof ledgeDetectionSystem.getLastAttempt> | null = null
  ): void => {
    if (!candidate && !attempt) {
      return;
    }

    const collisionDebugState = options.collisionSystem.getDebugState();
    const characterRootPosition = rootTransform
      ? new Vector3(rootTransform.x, rootTransform.y, rootTransform.z)
      : collisionDebugState.gameplayRootPosition.clone();
    const colliderCenterPosition = characterRootPosition.add(collisionDebugState.ellipsoidOffset);

    ledgeDebug.log(label, {
      candidate,
      probes: attempt?.probes ?? [],
      attemptReason: attempt?.reason ?? null,
      attemptKind: attempt?.kind ?? null,
      characterRootPosition,
      colliderCenterPosition,
      state,
      velocity,
      verticalVelocity,
      isGrounded,
      slopeAngleDegrees
    });

    const explicitDebugEnabled = (globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown })
      .__DAB_ADVANCED_MOVEMENT_DEBUG__;
    if (explicitDebugEnabled === true) {
      console.debug("[advanced-movement][collider]", {
        state,
        ellipsoid: {
          x: collisionDebugState.ellipsoid.x,
          y: collisionDebugState.ellipsoid.y,
          z: collisionDebugState.ellipsoid.z
        },
        ellipsoidOffset: {
          x: collisionDebugState.ellipsoidOffset.x,
          y: collisionDebugState.ellipsoidOffset.y,
          z: collisionDebugState.ellipsoidOffset.z
        }
      });
    }
  };

  const buildFrameOutput = (
    input: CharacterLocomotionFrameInput,
    params: {
      transform: { x: number; y: number; z: number; rotationY: number };
      movementDirection: MovementDirection;
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
      didLand: boolean;
      didCrouchEnter: boolean;
      didCrouchExit: boolean;
      didRollingStart: boolean;
      didRollingEnd: boolean;
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
    }
  ): CharacterLocomotionFrameOutput => {
    const state = stateMachine.resolve({
      nowMs: input.nowMs,
      isAlive: input.combat.isAlive,
      isStunned: input.combat.isStunned,
      isAttacking: input.combat.attackComboIndex > 0,
      isBlocking: input.combat.isBlocking && input.combat.attackComboIndex === 0,
      isGrounded: params.isGrounded,
      isMoving: params.isMoving,
      isSprinting: params.isSprinting,
      isCrouching: params.isCrouching,
      isRolling: params.isRolling,
      isLedgeHanging: params.isLedgeHanging,
      isLedgeClimbing: params.isLedgeClimbing,
      ledgeClimbMode: params.ledgeClimbMode ?? null,
      didGroundJump: params.didGroundJump,
      didDoubleJump: params.didDoubleJump,
      verticalVelocity: params.verticalVelocity
    });

    const snapshot: CharacterLocomotionSnapshot = {
      nowMs: input.nowMs,
      state,
      movementDirection: params.movementDirection,
      transform: params.transform,
      isGrounded: params.isGrounded,
      isMoving: params.isMoving,
      isSprinting: params.isSprinting,
      isCrouching: params.isCrouching,
      isRolling: params.isRolling,
      isWallRunning: false,
      wallRunSide: "none",
      didGroundJump: params.didGroundJump,
      didDoubleJump: params.didDoubleJump,
      didLand: params.didLand,
      didCrouchEnter: params.didCrouchEnter,
      didCrouchExit: params.didCrouchExit,
      didRollingStart: params.didRollingStart,
      didRollingEnd: params.didRollingEnd,
      didWallRunStart: false,
      didWallRunEnd: false,
      speedNormalized: params.speedNormalized,
      lateralInput: params.lateralInput,
      forwardInput: params.forwardInput,
      crouchAlpha: params.crouchAlpha,
      rollingAlpha: params.rollingAlpha,
      verticalVelocity: params.verticalVelocity,
      landingImpact: params.landingImpact,
      sprintIntent: params.sprintIntent,
      cameraProfile: {
        crouchOffsetY: locomotionConfig.crouchCameraOffsetY,
        rollingOffsetY: locomotionConfig.rollingCameraOffsetY,
        sprintFovBoostRadians: locomotionConfig.sprintFovBoostRadians,
        wallRunFovBoostRadians: 0,
        wallRunTiltRadians: 0
      }
    };

    return {
      transform: params.transform,
      animationState: resolveAnimationGameplayState({
        snapshot,
        combat: input.combat
      }),
      snapshot,
      isGrounded: params.isGrounded,
      isMoving: params.isMoving,
      isSprinting: params.isSprinting,
      isSprintBurstActive: params.isSprinting && input.nowMs <= sprintBurstUntilMs,
      didStartSprint: false,
      didLand: params.didLand,
      lateralInput: params.lateralInput,
      forwardInput: params.forwardInput,
      speedFeedback: params.speedNormalized,
      landingImpact: params.landingImpact
    };
  };

  const buildLedgeFrameOutput = (
    input: CharacterLocomotionFrameInput,
    params: {
      transform: CharacterLocomotionFrameOutput["transform"];
      isLedgeHanging: boolean;
      isLedgeClimbing: boolean;
      ledgeClimbMode?: "ledge" | "mantle" | null;
      isGrounded: boolean;
      verticalVelocity: number;
    }
  ): CharacterLocomotionFrameOutput => {
    return buildFrameOutput(input, {
      transform: params.transform,
      movementDirection: "none",
      isGrounded: params.isGrounded,
      isMoving: false,
      isSprinting: false,
      isCrouching: false,
      isRolling: false,
      isLedgeHanging: params.isLedgeHanging,
      isLedgeClimbing: params.isLedgeClimbing,
      ledgeClimbMode: params.ledgeClimbMode ?? null,
      didGroundJump: false,
      didDoubleJump: false,
      didLand: false,
      didCrouchEnter: false,
      didCrouchExit: false,
      didRollingStart: false,
      didRollingEnd: false,
      speedNormalized: 0,
      lateralInput: 0,
      forwardInput: 0,
      crouchAlpha: 0,
      rollingAlpha: 0,
      verticalVelocity: params.verticalVelocity,
      landingImpact: 0,
      sprintIntent: {
        isShiftPressed: false,
        isForwardPressed: false
      }
    });
  };

  return {
    step: (input) => {
      const inputEnabled = input.isInputEnabled && input.combat.isAlive && !input.combat.isStunned;
      const movementLocked = isCombatMovementLocked(input.combat);
      options.collisionSystem.syncToTransform(input.currentTransform);

      const activeHangLedge = ledgeHangSystem.getActiveLedge();
      const ledgeHangActive = activeHangLedge !== null;
      const ledgeClimbActive = ledgeClimbSystem.isActive();
      const movementEnabled = inputEnabled && !movementLocked && !ledgeHangActive && !ledgeClimbActive;
      let pendingLedgeAttempt: ReturnType<typeof ledgeDetectionSystem.getLastAttempt> | null = null;

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
      const approachDirection = hasDirectionalIntent ? desiredDirection : fallbackForward;

      const groundedBefore = options.groundedSystem.detect({
        position: {
          x: input.currentTransform.x,
          y: input.currentTransform.y,
          z: input.currentTransform.z
        },
        wasGrounded
      });

      const jumpPressed = inputEnabled && input.inputState.jump && !input.isFlyModeEnabled;
      const jumpPressedEdge = jumpPressed && !wasJumpPressed;
      wasJumpPressed = jumpPressed;

      if (!ledgeHangActive && !ledgeClimbActive && movementEnabled && jumpPressedEdge) {
        jumpSystem.queueJumpPress(input.nowMs);
      }

      jumpSystem.notifyGrounded(
        input.nowMs,
        groundedBefore.isGrounded && !ledgeHangActive && !ledgeClimbActive
      );
      doubleJumpSystem.resetIfGrounded(groundedBefore.isGrounded && !ledgeHangActive && !ledgeClimbActive);

      if (ledgeClimbActive) {
        if (input.isFlyModeEnabled || !input.combat.isAlive || input.combat.isStunned) {
          ledgeClimbSystem.reset();
          jumpSystem.setVerticalVelocity(ledgeConfig.dropReleaseVelocity);
        } else {
          const climbFrame = ledgeClimbSystem.step({ nowMs: input.nowMs });
          if (climbFrame.transform && climbFrame.ledge) {
            options.collisionSystem.setColliderProfile("climbingUp");
            jumpSystem.setVerticalVelocity(0);
            motor.setPlanarVelocity(Vector3.Zero());
            airborneTimeMs = 0;

            renderLedgeDebug(
              climbFrame.ledge,
              climbFrame.transform,
              climbFrame.locomotionState,
              Vector3.Zero(),
              0,
              false,
              climbFrame.ledge.slopeAngleDegrees
            );

            if (!climbFrame.didFinish) {
              wasGrounded = false;
              return buildLedgeFrameOutput(input, {
                transform: climbFrame.transform,
                isLedgeHanging: false,
                isLedgeClimbing: true,
                ledgeClimbMode: climbFrame.ledge.kind === "mantle" ? "mantle" : "ledge",
                isGrounded: false,
                verticalVelocity: 0
              });
            }

            const finalGrounding = options.groundedSystem.detect({
              position: {
                x: climbFrame.transform.x,
                y: climbFrame.transform.y,
                z: climbFrame.transform.z
              },
              wasGrounded: true
            });
            const isGroundedResolved = finalGrounding.isGrounded && !!finalGrounding.hitMesh;

            if (!isGroundedResolved) {
              wasGrounded = false;
              jumpSystem.setVerticalVelocity(ledgeConfig.dropReleaseVelocity);
              return buildLedgeFrameOutput(input, {
                transform: climbFrame.transform,
                isLedgeHanging: false,
                isLedgeClimbing: false,
                isGrounded: false,
                verticalVelocity: ledgeConfig.dropReleaseVelocity
              });
            }

            wasGrounded = true;
            const finalTransform = {
              x: climbFrame.transform.x,
              y: finalGrounding.groundY + runtimeConfig.collider.collisionClearanceY,
              z: climbFrame.transform.z,
              rotationY: climbFrame.transform.rotationY
            };
            return buildLedgeFrameOutput(input, {
              transform: finalTransform,
              isLedgeHanging: false,
              isLedgeClimbing: false,
              isGrounded: true,
              verticalVelocity: 0
            });
          }
        }
      }

      if (ledgeHangActive && activeHangLedge) {
        const shouldForceRelease =
          input.isFlyModeEnabled ||
          !input.combat.isAlive ||
          input.combat.isStunned;
        const wantsDrop =
          ledgeConfig.dropFromLedgeEnabled &&
          (input.inputState.backward || input.inputState.crouch);

        if (shouldForceRelease || wantsDrop) {
          logLedgeDebug(
            "hang-release",
            activeHangLedge,
            input.currentTransform,
            "Hanging",
            Vector3.Zero(),
            0,
            false,
            null
          );
          ledgeHangSystem.release(input.nowMs);
          jumpSystem.setVerticalVelocity(ledgeConfig.dropReleaseVelocity);
        } else if (jumpPressedEdge) {
          const consumed = ledgeHangSystem.consumeForClimb(input.nowMs);
          if (consumed) {
            logLedgeDebug(
              "climb-start",
              consumed,
              input.currentTransform,
              consumed.kind === "mantle" ? "MantlingLowObstacle" : "ClimbingUp",
              Vector3.Zero(),
              0,
              false,
              consumed.slopeAngleDegrees
            );
            ledgeClimbSystem.start({
              ledge: consumed,
              nowMs: input.nowMs,
              durationMs: consumed.kind === "mantle" ? ledgeConfig.mantleDurationMs : ledgeConfig.climbDurationMs,
              startPosition: consumed.hangPosition,
              endPosition: consumed.climbEndPosition
            });

            const climbFrame = ledgeClimbSystem.step({ nowMs: input.nowMs });
            if (climbFrame.transform && climbFrame.ledge) {
              options.collisionSystem.setColliderProfile("climbingUp");
              jumpSystem.setVerticalVelocity(0);
              motor.setPlanarVelocity(Vector3.Zero());
              airborneTimeMs = 0;
              wasGrounded = false;

              renderLedgeDebug(
                climbFrame.ledge,
                climbFrame.transform,
                climbFrame.locomotionState,
                Vector3.Zero(),
                0,
                false,
                climbFrame.ledge.slopeAngleDegrees
              );

              return buildLedgeFrameOutput(input, {
                transform: climbFrame.transform,
                isLedgeHanging: false,
                isLedgeClimbing: true,
                ledgeClimbMode: climbFrame.ledge.kind === "mantle" ? "mantle" : "ledge",
                isGrounded: false,
                verticalVelocity: 0
              });
            }
          }
        }

        const lockedTransform = ledgeHangSystem.getLockedTransform();
        if (lockedTransform && activeHangLedge) {
          options.collisionSystem.setColliderProfile("hanging");
          jumpSystem.setVerticalVelocity(0);
          motor.setPlanarVelocity(Vector3.Zero());
          airborneTimeMs = 0;
          wasGrounded = false;

          renderLedgeDebug(
            activeHangLedge,
            lockedTransform,
            "Hanging",
            Vector3.Zero(),
            0,
            false,
            activeHangLedge.slopeAngleDegrees
          );

          return buildLedgeFrameOutput(input, {
            transform: lockedTransform,
            isLedgeHanging: true,
            isLedgeClimbing: false,
            isGrounded: false,
            verticalVelocity: 0
          });
        }
      }

      const canSprint =
        movementEnabled &&
        groundedBefore.isGrounded &&
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
        canRoll:
          groundedBefore.isGrounded &&
          groundedBefore.distanceToGround <= locomotionConfig.groundedSnapDistance + 0.03 &&
          jumpSystem.getVerticalVelocity() <= 0.2 &&
          canSprint &&
          hasDirectionalIntent,
        isGrounded: groundedBefore.isGrounded,
        currentSpeed: canSprint ? locomotionConfig.runSpeed * sprintMultiplier : locomotionConfig.walkSpeed,
        forwardDirection: hasDirectionalIntent ? desiredDirection.clone() : fallbackForward,
        minSpeed: locomotionConfig.rollingMinSpeed,
        initialSpeed: locomotionConfig.rollingInitialSpeed,
        durationMs: locomotionConfig.rollingDurationMs,
        cooldownMs: locomotionConfig.rollingCooldownMs,
        groundDetachGraceMs: 90
      });

      const wantsStationaryCrouch =
        movementEnabled &&
        input.inputState.crouch &&
        !rollingOutput.isRolling &&
        !hasDirectionalIntent;
      const crouchOutput = crouchSystem.step({
        deltaSeconds: input.deltaSeconds,
        wantsCrouch: wantsStationaryCrouch,
        forcedCrouch: rollingOutput.forcesCompactCollider
      });
      const isCrouchStateActive =
        crouchOutput.isCrouched && wantsStationaryCrouch && !rollingOutput.forcesCompactCollider;

      updateColliderForState({
        isRolling: rollingOutput.isRolling,
        crouchAlpha: crouchOutput.alpha
      });

      if (
        !input.isFlyModeEnabled &&
        movementEnabled &&
        groundedBefore.isGrounded &&
        jumpPressedEdge &&
        !rollingOutput.isRolling &&
        !isCrouchStateActive &&
        hasDirectionalIntent
      ) {
        const mantleCandidate = ledgeDetectionSystem.detectMantle({
          currentTransform: input.currentTransform,
          approachDirection
        });
        if (mantleCandidate) {
          logLedgeDebug(
            "mantle-start",
            mantleCandidate,
            input.currentTransform,
            "MantlingLowObstacle",
            motor.getPlanarVelocity(),
            jumpSystem.getVerticalVelocity(),
            groundedBefore.isGrounded,
            groundedBefore.slopeAngleDegrees
          );
          ledgeClimbSystem.start({
            ledge: mantleCandidate,
            nowMs: input.nowMs,
            durationMs: ledgeConfig.mantleDurationMs,
            startPosition: new Vector3(
              input.currentTransform.x,
              input.currentTransform.y,
              input.currentTransform.z
            ),
            endPosition: mantleCandidate.climbEndPosition
          });

          const climbFrame = ledgeClimbSystem.step({ nowMs: input.nowMs });
          if (climbFrame.transform && climbFrame.ledge) {
            options.collisionSystem.setColliderProfile("mantle");
            jumpSystem.setVerticalVelocity(0);
            motor.setPlanarVelocity(Vector3.Zero());
            airborneTimeMs = 0;
            wasGrounded = false;
            renderLedgeDebug(
              climbFrame.ledge,
              climbFrame.transform,
              climbFrame.locomotionState,
              Vector3.Zero(),
              0,
              false,
              climbFrame.ledge.slopeAngleDegrees
            );
            return buildLedgeFrameOutput(input, {
              transform: climbFrame.transform,
              isLedgeHanging: false,
              isLedgeClimbing: true,
              ledgeClimbMode: "mantle",
              isGrounded: false,
              verticalVelocity: 0
            });
          }
        } else {
          pendingLedgeAttempt = ledgeDetectionSystem.getLastAttempt();
        }
      }

      if (
        !input.isFlyModeEnabled &&
        inputEnabled &&
        !movementLocked &&
        !groundedBefore.isGrounded &&
        jumpSystem.getVerticalVelocity() <= 0.15 &&
        !rollingOutput.isRolling &&
        !isCrouchStateActive &&
        ledgeHangSystem.canGrab(input.nowMs)
      ) {
        const ledgeCandidate = ledgeDetectionSystem.detectLedge({
          currentTransform: input.currentTransform,
          approachDirection
        });

        if (ledgeCandidate && ledgeHangSystem.grab(ledgeCandidate, input.nowMs)) {
          options.collisionSystem.setColliderProfile("hanging");
          jumpSystem.setVerticalVelocity(0);
          motor.setPlanarVelocity(Vector3.Zero());
          airborneTimeMs = 0;
          wasGrounded = false;

          logLedgeDebug(
            "hang-grab",
            ledgeCandidate,
            input.currentTransform,
            "Hanging",
            Vector3.Zero(),
            0,
            false,
            ledgeCandidate.slopeAngleDegrees
          );

          const hangTransform = {
            x: ledgeCandidate.hangPosition.x,
            y: ledgeCandidate.hangPosition.y,
            z: ledgeCandidate.hangPosition.z,
            rotationY: ledgeCandidate.rotationY
          };
          renderLedgeDebug(
            ledgeCandidate,
            hangTransform,
            "Hanging",
            Vector3.Zero(),
            0,
            false,
            ledgeCandidate.slopeAngleDegrees
          );

          return buildLedgeFrameOutput(input, {
            transform: hangTransform,
            isLedgeHanging: true,
            isLedgeClimbing: false,
            isGrounded: false,
            verticalVelocity: 0
          });
        } else {
          pendingLedgeAttempt = ledgeDetectionSystem.getLastAttempt();
        }
      }

      let didGroundJump = false;
      let didDoubleJump = false;

      if (!input.isFlyModeEnabled && movementEnabled) {
        if (jumpSystem.consumeGroundJump(input.nowMs)) {
          jumpSystem.setVerticalVelocity(locomotionConfig.jumpVelocity);
          const jumpBoostVelocity = applyRunJumpImpulse({
            currentVelocity: motor.getPlanarVelocity(),
            forwardDirection: hasDirectionalIntent ? desiredDirection : fallbackForward,
            isSprinting: canSprint,
            runtimeConfig
          });
          motor.setPlanarVelocity(jumpBoostVelocity);
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
        isGrounded: groundedBefore.isGrounded && !didGroundJump && !didDoubleJump,
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

        if (rollingOutput.isRolling && verticalVelocity > 0) {
          jumpSystem.setVerticalVelocity(0);
          verticalVelocity = 0;
          verticalDisplacement = 0;
        }

        if (groundedBefore.isGrounded && verticalVelocity <= 0) {
          const stickMultiplier = rollingOutput.groundStickFactor > 0 ? 1.2 : 1;
          verticalDisplacement -= locomotionConfig.groundStickForce * stickMultiplier * input.deltaSeconds;
        }
      }

      let horizontalDisplacement = new Vector3(
        motorOutput.displacement.x,
        0,
        motorOutput.displacement.z
      );

      if (groundedBefore.isGrounded && groundedBefore.groundNormal) {
        horizontalDisplacement = projectMovementOnGround(horizontalDisplacement, groundedBefore.groundNormal);
      }

      const collisionResult = options.collisionSystem.moveAndSlide(
        new Vector3(
          horizontalDisplacement.x,
          verticalDisplacement,
          horizontalDisplacement.z
        )
      );

      if (verticalDisplacement > 0 && collisionResult.appliedDisplacement.y < verticalDisplacement * 0.35) {
        jumpSystem.setVerticalVelocity(Math.min(0, jumpSystem.getVerticalVelocity()));
        verticalVelocity = jumpSystem.getVerticalVelocity();
      }

      const groundedAfter = input.isFlyModeEnabled
        ? {
            isGrounded: false,
            groundY: collisionResult.transform.y,
            distanceToGround: Number.POSITIVE_INFINITY,
            slopeAngleDegrees: 90,
            groundNormal: null,
            hitMesh: null
          }
        : options.groundedSystem.detect({
            position: {
              x: collisionResult.transform.x,
              y: collisionResult.transform.y,
              z: collisionResult.transform.z
            },
            wasGrounded: groundedBefore.isGrounded
          });

      const snapDistance = Math.max(
        runtimeConfig.collider.collisionClearanceY,
        locomotionConfig.groundedStickDistance + (rollingOutput.isRolling ? 0.1 : 0)
      );
      const shouldSnapToGround =
        !input.isFlyModeEnabled &&
        !!groundedAfter.hitMesh &&
        verticalVelocity <= 0 &&
        collisionResult.transform.y <= groundedAfter.groundY + snapDistance;
      const isGroundedResolved = groundedAfter.isGrounded || shouldSnapToGround;

      let nextY = collisionResult.transform.y;
      if (!input.isFlyModeEnabled && isGroundedResolved && verticalVelocity <= 0.01) {
        nextY = groundedAfter.groundY + runtimeConfig.collider.collisionClearanceY;
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
      const speedNormalized = speedCap > 0
        ? Math.max(0, Math.min(1, motorOutput.speed / speedCap))
        : 0;

      const frameOutput = buildFrameOutput(input, {
        transform,
        movementDirection,
        isGrounded: isGroundedResolved,
        isMoving: motorOutput.isMoving,
        isSprinting: canSprint,
        isCrouching: isCrouchStateActive,
        isRolling: rollingOutput.isRolling,
        isLedgeHanging: false,
        isLedgeClimbing: false,
        didGroundJump,
        didDoubleJump,
        didLand,
        didCrouchEnter: crouchOutput.didEnter,
        didCrouchExit: crouchOutput.didExit,
        didRollingStart: rollingOutput.didStart,
        didRollingEnd: rollingOutput.didEnd,
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
        }
      });

      const planarVelocity = motor.getPlanarVelocity();
      const velocity = new Vector3(planarVelocity.x, verticalVelocity, planarVelocity.z);
      if (pendingLedgeAttempt && input.nowMs - lastDetectionRejectLogAtMs >= 140) {
        lastDetectionRejectLogAtMs = input.nowMs;
        logLedgeDebug(
          "detect-reject",
          null,
          transform,
          frameOutput.snapshot.state,
          velocity,
          verticalVelocity,
          isGroundedResolved,
          groundedAfter.slopeAngleDegrees,
          pendingLedgeAttempt
        );
      }
      renderLedgeDebug(
        null,
        transform,
        frameOutput.snapshot.state,
        velocity,
        verticalVelocity,
        isGroundedResolved,
        groundedAfter.slopeAngleDegrees,
        pendingLedgeAttempt
      );

      return {
        ...frameOutput,
        isSprintBurstActive,
        didStartSprint
      };
    },
    reset: () => {
      motor.reset();
      jumpSystem.reset();
      doubleJumpSystem.reset();
      crouchSystem.reset();
      rollingSystem.reset();
      stateMachine.reset();
      ledgeHangSystem.reset();
      ledgeClimbSystem.reset();
      wasJumpPressed = false;
      wasGrounded = false;
      wasSprinting = false;
      airborneTimeMs = 0;
      sprintBurstUntilMs = 0;
      lastDetectionRejectLogAtMs = 0;
      restoreDefaultCollider();
      ledgeDebug.render(null);
    },
    dispose: () => {
      ledgeDebug.dispose();
    }
  };
}
