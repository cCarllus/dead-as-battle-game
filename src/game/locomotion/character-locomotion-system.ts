// Responsável por orquestrar movimento, salto, ledge grab/climb, câmera e áudio em um pipeline único de personagem.
import { Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { AnimationGameplayState } from "../animation/animation-state";
import { resolveAnimationGameplayState } from "../animation/animation-state-machine";
import type { CharacterRuntimeConfig } from "../character/character-config";
import {
  isCombatMovementLocked,
  type CombatHookState
} from "../combat/combat-hooks";
import { resolveLandingImpactFromAirTime } from "../effects/landing-impact";
import type { CollisionSystem } from "../systems/collision.system";
import { createCharacterMotor } from "./character-motor";
import { createCharacterStateMachine } from "./character-state-machine";
import { createCrouchSystem } from "./crouch-system";
import { createDoubleJumpSystem } from "./double-jump-system";
import type { GroundedSystem } from "./grounded-system";
import { createJumpSystem } from "./jump-system";
import { createLedgeClimbSystem } from "./ledge-climb-system";
import { createLedgeDebug } from "./ledge-debug";
import { createLedgeDetectionSystem } from "./ledge-detection-system";
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
  const ledgeConfig = options.runtimeConfig.ledge;
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
    runtimeConfig: options.runtimeConfig,
    groundedSystem: options.groundedSystem,
    isEnvironmentMesh: options.isEnvironmentMesh,
    isClimbableMesh: options.isClimbableMesh
  });
  const ledgeDebug = createLedgeDebug(options.scene);
  const ledgeHangSystem = createLedgeHangSystem(ledgeConfig);
  const ledgeClimbSystem = createLedgeClimbSystem();

  let wasJumpPressed = false;
  let wasGrounded = false;
  let wasSprinting = false;
  let airborneTimeMs = 0;
  let sprintBurstUntilMs = 0;

  const renderLedgeDebug = (
    candidate: ReturnType<typeof ledgeHangSystem.getActiveLedge>,
    rootTransform:
      | CharacterLocomotionFrameInput["currentTransform"]
      | CharacterLocomotionFrameOutput["transform"]
      | null
  ): void => {
    if (!candidate) {
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
      characterRootPosition,
      colliderCenterPosition
    });
  };

  const logLedgeDebug = (
    label: string,
    candidate: ReturnType<typeof ledgeHangSystem.getActiveLedge>,
    rootTransform:
      | CharacterLocomotionFrameInput["currentTransform"]
      | CharacterLocomotionFrameOutput["transform"]
      | null
  ): void => {
    if (!candidate) {
      return;
    }

    const collisionDebugState = options.collisionSystem.getDebugState();
    const characterRootPosition = rootTransform
      ? new Vector3(rootTransform.x, rootTransform.y, rootTransform.z)
      : collisionDebugState.gameplayRootPosition.clone();
    const colliderCenterPosition = characterRootPosition.add(collisionDebugState.ellipsoidOffset);

    ledgeDebug.log(label, {
      candidate,
      characterRootPosition,
      colliderCenterPosition
    });
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

  return {
    step: (input) => {
      const activeHangLedge = ledgeHangSystem.getActiveLedge();
      const ledgeHangActive = activeHangLedge !== null;
      const ledgeClimbActive = ledgeClimbSystem.isActive();
      const inputEnabled = input.isInputEnabled && input.combat.isAlive && !input.combat.isStunned;
      const movementLocked = isCombatMovementLocked(input.combat);
      const movementEnabled = inputEnabled && !movementLocked && !ledgeHangActive && !ledgeClimbActive;
      renderLedgeDebug(null, null);

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

      if (ledgeHangActive) {
        const shouldForceRelease =
          input.isFlyModeEnabled ||
          !input.combat.isAlive ||
          input.combat.isStunned;
        const wantsDrop =
          ledgeConfig.dropFromLedgeEnabled &&
          (input.inputState.backward || input.inputState.crouch);

        if (shouldForceRelease || wantsDrop) {
          logLedgeDebug("release", activeHangLedge, input.currentTransform);
          ledgeHangSystem.release(input.nowMs);
          jumpSystem.setVerticalVelocity(ledgeConfig.dropReleaseVelocity);
        } else if (jumpPressedEdge) {
          const activeLedge = ledgeHangSystem.consumeForClimb(input.nowMs);
          if (activeLedge) {
            logLedgeDebug("climb-start", activeLedge, {
              x: activeLedge.hangPosition.x,
              y: activeLedge.hangPosition.y,
              z: activeLedge.hangPosition.z,
              rotationY: activeLedge.rotationY
            });
            ledgeClimbSystem.start({
              ledge: activeLedge,
              nowMs: input.nowMs,
              durationMs: ledgeConfig.climbDurationOverrideMs
            });

            const climbFrame = ledgeClimbSystem.step({ nowMs: input.nowMs });
            if (climbFrame.transform) {
              renderLedgeDebug(activeLedge, climbFrame.transform);
              options.collisionSystem.setColliderHeight(
                options.runtimeConfig.colliderHeight,
                options.runtimeConfig.colliderRadius
              );
              jumpSystem.setVerticalVelocity(0);
              airborneTimeMs = 0;
              wasGrounded = false;

              return buildFrameOutput(input, {
                transform: climbFrame.transform,
                movementDirection: "none",
                isGrounded: false,
                isMoving: false,
                isSprinting: false,
                isCrouching: false,
                isRolling: false,
                isLedgeHanging: false,
                isLedgeClimbing: true,
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
                verticalVelocity: 0,
                landingImpact: 0,
                sprintIntent: {
                  isShiftPressed: false,
                  isForwardPressed: false
                }
              });
            }
          }
        } else {
          const lockedTransform = ledgeHangSystem.getLockedTransform();
          if (lockedTransform) {
            renderLedgeDebug(activeHangLedge, lockedTransform);
            options.collisionSystem.setColliderHeight(
              options.runtimeConfig.colliderHeight,
              options.runtimeConfig.colliderRadius
            );
            jumpSystem.setVerticalVelocity(0);
            airborneTimeMs = 0;
            wasGrounded = false;

            return buildFrameOutput(input, {
              transform: lockedTransform,
              movementDirection: "none",
              isGrounded: false,
              isMoving: false,
              isSprinting: false,
              isCrouching: false,
              isRolling: false,
              isLedgeHanging: true,
              isLedgeClimbing: false,
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
              verticalVelocity: 0,
              landingImpact: 0,
              sprintIntent: {
                isShiftPressed: false,
                isForwardPressed: false
              }
            });
          }
        }
      }

      if (ledgeClimbActive) {
        if (input.isFlyModeEnabled || !input.combat.isAlive || input.combat.isStunned) {
          ledgeClimbSystem.reset();
          jumpSystem.setVerticalVelocity(ledgeConfig.dropReleaseVelocity);
        } else {
          const climbFrame = ledgeClimbSystem.step({ nowMs: input.nowMs });
          if (climbFrame.transform) {
            renderLedgeDebug(climbFrame.ledge, climbFrame.transform);
            options.collisionSystem.setColliderHeight(
              options.runtimeConfig.colliderHeight,
              options.runtimeConfig.colliderRadius
            );
            jumpSystem.setVerticalVelocity(0);
            airborneTimeMs = 0;

            if (!climbFrame.didFinish) {
              wasGrounded = false;
              return buildFrameOutput(input, {
                transform: climbFrame.transform,
                movementDirection: "none",
                isGrounded: false,
                isMoving: false,
                isSprinting: false,
                isCrouching: false,
                isRolling: false,
                isLedgeHanging: false,
                isLedgeClimbing: true,
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
                verticalVelocity: 0,
                landingImpact: 0,
                sprintIntent: {
                  isShiftPressed: false,
                  isForwardPressed: false
                }
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
              return buildFrameOutput(input, {
                transform: climbFrame.transform,
                movementDirection: "none",
                isGrounded: false,
                isMoving: false,
                isSprinting: false,
                isCrouching: false,
                isRolling: false,
                isLedgeHanging: false,
                isLedgeClimbing: false,
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
                verticalVelocity: ledgeConfig.dropReleaseVelocity,
                landingImpact: 0,
                sprintIntent: {
                  isShiftPressed: false,
                  isForwardPressed: false
                }
              });
            }

            wasGrounded = true;
            return buildFrameOutput(input, {
              transform: {
                x: climbFrame.transform.x,
                y: finalGrounding.groundY + options.runtimeConfig.collisionClearanceY,
                z: climbFrame.transform.z,
                rotationY: climbFrame.transform.rotationY
              },
              movementDirection: "none",
              isGrounded: true,
              isMoving: false,
              isSprinting: false,
              isCrouching: false,
              isRolling: false,
              isLedgeHanging: false,
              isLedgeClimbing: false,
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
              verticalVelocity: 0,
              landingImpact: 0,
              sprintIntent: {
                isShiftPressed: false,
                isForwardPressed: false
              }
            });
          }
        }
      }

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

      const canAttemptLedgeGrab =
        !input.isFlyModeEnabled &&
        inputEnabled &&
        !movementLocked &&
        !groundedBefore.isGrounded &&
        !rollingOutput.isRolling &&
        !isCrouchStateActive &&
        !didGroundJump &&
        !didDoubleJump &&
        ledgeHangSystem.canGrab(input.nowMs);

      if (canAttemptLedgeGrab) {
        const ledgeCandidate = ledgeDetectionSystem.detect({
          currentTransform: input.currentTransform,
          approachDirection
        });

        if (ledgeCandidate && ledgeHangSystem.grab(ledgeCandidate, input.nowMs)) {
          renderLedgeDebug(ledgeCandidate, {
            x: ledgeCandidate.hangPosition.x,
            y: ledgeCandidate.hangPosition.y,
            z: ledgeCandidate.hangPosition.z,
            rotationY: ledgeCandidate.rotationY
          });
          logLedgeDebug("grab", ledgeCandidate, {
            x: ledgeCandidate.hangPosition.x,
            y: ledgeCandidate.hangPosition.y,
            z: ledgeCandidate.hangPosition.z,
            rotationY: ledgeCandidate.rotationY
          });
          options.collisionSystem.setColliderHeight(
            options.runtimeConfig.colliderHeight,
            options.runtimeConfig.colliderRadius
          );
          jumpSystem.setVerticalVelocity(0);
          airborneTimeMs = 0;
          wasGrounded = false;

          return buildFrameOutput(input, {
            transform: {
              x: ledgeCandidate.hangPosition.x,
              y: ledgeCandidate.hangPosition.y,
              z: ledgeCandidate.hangPosition.z,
              rotationY: ledgeCandidate.rotationY
            },
            movementDirection: "none",
            isGrounded: false,
            isMoving: false,
            isSprinting: false,
            isCrouching: false,
            isRolling: false,
            isLedgeHanging: true,
            isLedgeClimbing: false,
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
            verticalVelocity: 0,
            landingImpact: 0,
            sprintIntent: {
              isShiftPressed: false,
              isForwardPressed: false
            }
          });
        }
      }

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
      renderLedgeDebug(null, null);
    },
    dispose: () => {
      ledgeDebug.dispose();
    }
  };
}
