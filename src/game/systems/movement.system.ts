// Responsável por orquestrar motor, salto, grounded e colisão para o movimento local com sensação mais polida.
import { Vector3 } from "@babylonjs/core";
import type { AnimationGameplayState, MovementDirection } from "../animation/animation-state";
import { createMovementAnimationStateMachine } from "../animation/movement-animation-state-machine";
import { createCharacterMotorController } from "../controllers/character-motor.controller";
import { resolveLandingImpactFromAirTime } from "../effects/landing-impact";
import { createJumpController } from "../controllers/jump.controller";
import { createSprintSystem } from "../movement/sprint-system";
import type { PlayerPhysicsConfig } from "../physics/player-physics";
import type { AnimationStateSystem } from "./animation-state.system";
import type { CollisionSystem } from "./collision.system";
import type { GroundedSystem } from "./grounded.system";

export type MovementSystemInputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  descend: boolean;
};

export type MovementSystemFrameInput = {
  nowMs: number;
  deltaSeconds: number;
  currentTransform: { x: number; y: number; z: number; rotationY: number };
  inputState: MovementSystemInputState;
  cameraForward: Vector3;
  isInputEnabled: boolean;
  isFlyModeEnabled: boolean;
  canMove: boolean;
  canSprint: boolean;
  isAlive: boolean;
  isUltimateActive: boolean;
  isBlocking: boolean;
  combatState: "CombatIdle" | "AttackWindup" | "AttackActive" | "AttackRecovery" | "HitReact" | "SkillCast" | "Dead" | "Block";
  attackComboIndex: 0 | 1 | 2 | 3;
  activeSkillId: string;
  isStunned: boolean;
};

export type MovementSystemFrameOutput = {
  transform: { x: number; y: number; z: number; rotationY: number };
  animationState: AnimationGameplayState;
  isGrounded: boolean;
  didLand: boolean;
  movementDirection: MovementDirection;
  isMoving: boolean;
  isSprinting: boolean;
  sprintIntent: {
    isShiftPressed: boolean;
    isForwardPressed: boolean;
  };
  speedFeedback: number;
  lateralInput: number;
  forwardInput: number;
  didStartSprint: boolean;
  isSprintBurstActive: boolean;
  landingImpact: number;
  airborneTimeMs: number;
};

export type MovementSystem = {
  step: (input: MovementSystemFrameInput) => MovementSystemFrameOutput;
  reset: () => void;
};

export type CreateMovementSystemOptions = {
  physicsConfig: PlayerPhysicsConfig;
  groundedSystem: GroundedSystem;
  collisionSystem: CollisionSystem;
  animationStateSystem: AnimationStateSystem;
};

const UPWARD_GROUNDED_LOCKOUT_VELOCITY = 0.35;
const MIN_AIRBORNE_TIME_FOR_LAND_MS = 80;
const GROUND_CLEARANCE_Y = 0.02;

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
  const forward = cameraForward.lengthSquared() > 0.0001 ? cameraForward.normalizeToNew() : new Vector3(0, 0, 1);
  const right = new Vector3(forward.z, 0, -forward.x);

  return new Vector3(
    forward.x * forwardAxis + right.x * sideAxis,
    0,
    forward.z * forwardAxis + right.z * sideAxis
  );
}

export function createMovementSystem(options: CreateMovementSystemOptions): MovementSystem {
  const motorController = createCharacterMotorController(options.physicsConfig);
  const jumpController = createJumpController(options.physicsConfig);
  const locomotionStateMachine = createMovementAnimationStateMachine();
  const sprintSystem = createSprintSystem({
    burstDurationMs: options.physicsConfig.sprintBurstDurationMs,
    burstMultiplier: options.physicsConfig.sprintBurstSpeedMultiplier
  });

  let wasJumpPressed = false;
  let wasGrounded = false;
  let airborneTimeMs = 0;

  return {
    step: (input) => {
      const inputEnabled = input.isInputEnabled && input.isAlive;
      const movementEnabled = inputEnabled && input.canMove;

      const forwardAxis = movementEnabled
        ? (input.inputState.forward ? 1 : 0) - (input.inputState.backward ? 1 : 0)
        : 0;
      const sideAxis = movementEnabled
        ? (input.inputState.right ? 1 : 0) - (input.inputState.left ? 1 : 0)
        : 0;

      const movementDirection = resolveMovementDirectionFromAxes(forwardAxis, sideAxis);
      const desiredDirection = resolveDesiredDirection(input.cameraForward, forwardAxis, sideAxis);
      const hasDirectionalIntent = desiredDirection.lengthSquared() > 0.00001;

      const groundedBeforeMove = options.groundedSystem.detect({
        position: {
          x: input.currentTransform.x,
          y: input.currentTransform.y,
          z: input.currentTransform.z
        },
        wasGrounded
      });

      if (input.inputState.jump && !wasJumpPressed && inputEnabled && !input.isFlyModeEnabled) {
        jumpController.queueJumpPress(input.nowMs);
      }
      wasJumpPressed = input.inputState.jump;

      const canUseSprint =
        movementEnabled &&
        input.canSprint &&
        input.inputState.descend &&
        input.inputState.forward &&
        movementDirection !== "none";
      const sprintFeedback = sprintSystem.update({
        nowMs: input.nowMs,
        isSprinting: canUseSprint
      });

      const motorOutput = motorController.step({
        deltaSeconds: input.deltaSeconds,
        desiredWorldDirection: hasDirectionalIntent ? desiredDirection : Vector3.Zero(),
        currentRotationY: input.currentTransform.rotationY,
        isGrounded: groundedBeforeMove.isGrounded,
        wantsSprint: canUseSprint,
        sprintBoostMultiplier: sprintFeedback.burstMultiplier,
        canMove: movementEnabled && !input.isFlyModeEnabled
      });

      let desiredDisplacement = motorOutput.displacement;
      let didStartJump = false;
      let didLand = false;
      let verticalVelocity = 0;
      let verticalDisplacement = 0;

      if (input.isFlyModeEnabled) {
        const verticalAxis = movementEnabled
          ? (input.inputState.jump ? 1 : 0) - (input.inputState.descend ? 1 : 0)
          : 0;
        verticalDisplacement = verticalAxis * options.physicsConfig.walkSpeed * input.deltaSeconds;
      } else {
        const jumpOutput = jumpController.step({
          deltaSeconds: input.deltaSeconds,
          nowMs: input.nowMs,
          isGrounded: groundedBeforeMove.isGrounded
        });

        verticalDisplacement = jumpOutput.verticalDisplacement;
        didStartJump = jumpOutput.didStartJump;
        verticalVelocity = jumpOutput.verticalVelocity;
      }

      const collisionResult = options.collisionSystem.moveAndSlide(
        new Vector3(desiredDisplacement.x, 0, desiredDisplacement.z)
      );
      const projectedNextY = input.currentTransform.y + verticalDisplacement;
      const groundedAfterMoveRaw = input.isFlyModeEnabled
        ? {
            isGrounded: false,
            groundY: projectedNextY,
            distanceToGround: Number.POSITIVE_INFINITY,
            hitMesh: null
          }
        : options.groundedSystem.detect({
            position: {
              x: collisionResult.transform.x,
              y: projectedNextY,
              z: collisionResult.transform.z
            },
            wasGrounded: groundedBeforeMove.isGrounded
          });
      const shouldLockGroundedByUpwardVelocity =
        !input.isFlyModeEnabled && verticalVelocity > UPWARD_GROUNDED_LOCKOUT_VELOCITY;
      const groundedAfterMove = {
        ...groundedAfterMoveRaw,
        isGrounded: groundedAfterMoveRaw.isGrounded && !shouldLockGroundedByUpwardVelocity
      };

      let nextY = projectedNextY;
      if (!input.isFlyModeEnabled && groundedAfterMove.isGrounded && verticalVelocity <= 0.01) {
        nextY = groundedAfterMove.groundY + GROUND_CLEARANCE_Y;
      }

      let landingImpact = 0;
      if (groundedAfterMove.isGrounded) {
        didLand = !wasGrounded && airborneTimeMs >= MIN_AIRBORNE_TIME_FOR_LAND_MS;
        if (didLand) {
          landingImpact = resolveLandingImpactFromAirTime(airborneTimeMs);
        }
        airborneTimeMs = 0;
      } else {
        airborneTimeMs += input.deltaSeconds * 1000;
      }

      wasGrounded = groundedAfterMove.isGrounded;

      const locomotionState = locomotionStateMachine.resolve({
        nowMs: input.nowMs,
        isGrounded: input.isFlyModeEnabled ? false : groundedAfterMove.isGrounded,
        isMoving: motorOutput.isMoving,
        isSprinting: canUseSprint,
        didStartJump
      });

      const animationState = options.animationStateSystem.resolve({
        isAlive: input.isAlive,
        isUltimateActive: input.isUltimateActive,
        isBlocking: input.isBlocking,
        combatState: input.combatState,
        attackComboIndex: input.attackComboIndex,
        activeSkillId: input.activeSkillId,
        isStunned: input.isStunned,
        locomotionState,
        movementDirection
      });

      return {
        transform: {
          x: collisionResult.transform.x,
          y: nextY,
          z: collisionResult.transform.z,
          rotationY: motorOutput.nextRotationY
        },
        animationState,
        isGrounded: groundedAfterMove.isGrounded,
        didLand,
        movementDirection,
        isMoving: motorOutput.isMoving,
        isSprinting: canUseSprint,
        sprintIntent: {
          isShiftPressed: input.canSprint && input.inputState.descend,
          isForwardPressed: input.canSprint && input.inputState.forward
        },
        speedFeedback: Math.max(
          0,
          Math.min(
            1,
            motorOutput.speed /
              (options.physicsConfig.runSpeed * (canUseSprint ? options.physicsConfig.sprintBurstSpeedMultiplier : 1))
          )
        ),
        lateralInput: sideAxis,
        forwardInput: forwardAxis,
        didStartSprint: sprintFeedback.didStartSprint,
        isSprintBurstActive: sprintFeedback.isBurstActive,
        landingImpact,
        airborneTimeMs
      };
    },
    reset: () => {
      motorController.reset();
      jumpController.reset();
      sprintSystem.reset();
      locomotionStateMachine.reset();
      wasJumpPressed = false;
      wasGrounded = false;
      airborneTimeMs = 0;
    }
  };
}
