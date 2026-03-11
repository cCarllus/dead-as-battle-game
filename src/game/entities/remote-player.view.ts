// Responsável por tipar a view de player desacoplada com gameplayRoot autoritativo e camada visual independente.
import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { AnimationCommand } from "../animation/animation-command";
import type { CharacterRuntimeConfig } from "../character/character-config";
import {
  createDefaultAnimationGameplayState,
  type AnimationGameplayState,
  type MovementDirection
} from "../animation/animation-state";
import {
  createMatchPlayerEntity,
  type MatchPlayerEntity,
  type PlayerVisualStyle
} from "./player.entity";

const MOVEMENT_START_EPSILON_SQUARED = 0.0004;
const MOVEMENT_STOP_EPSILON_SQUARED = 0.0001;
const MOVEMENT_DIRECTION_STICKY_EPSILON_SQUARED = 0.0016;
const VERTICAL_MOVEMENT_EPSILON = 0.02;
const REMOTE_IDLE_TIMEOUT_MS = 480;
const JUMP_ANIMATION_GRACE_MS = 260;
const SPRINT_ANIMATION_GRACE_MS = 180;
const ATTACK_ANIMATION_GRACE_MS = 240;
const REMOTE_POSITION_SMOOTH_TIME_MS = 95;
const REMOTE_ROTATION_SMOOTH_TIME_MS = 80;
const REMOTE_SNAP_DISTANCE_SQUARED = 36;
const REMOTE_MAX_TICK_DELTA_MS = 200;

export type PlayerViewRole = "local" | "teammate" | "enemy";

export type RemotePlayerView = {
  sessionId: string;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  groundCheck: TransformNode;
  wallCheckLeft: TransformNode;
  wallCheckRight: TransformNode;
  visualRoot: TransformNode;
  audioRoot: TransformNode;
  cameraTargetAnchor: TransformNode;
  nameplateNode: AbstractMesh;
  role: PlayerViewRole;
  nickname: string;
  heroId: string;
  lastKnownPosition: { x: number; y: number; z: number };
  lastKnownRotationY: number;
  updateFromState: (player: MatchPlayerState, animationOverride?: AnimationGameplayState) => void;
  tick: (nowMs: number) => void;
  playAnimationCommand: (command: AnimationCommand) => void;
  getTransform: () => { x: number; y: number; z: number; rotationY: number };
  getCameraTarget: () => { x: number; y: number; z: number };
  getRuntimeConfig: () => CharacterRuntimeConfig;
  dispose: () => void;
};

function lerp(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
}

function resolveExponentialLerpFactor(deltaMs: number, smoothTimeMs: number): number {
  if (deltaMs <= 0) {
    return 0;
  }

  if (smoothTimeMs <= 0) {
    return 1;
  }

  return 1 - Math.exp(-deltaMs / smoothTimeMs);
}

function normalizeAngleRadians(angle: number): number {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized > Math.PI) {
    normalized -= tau;
  }
  if (normalized < -Math.PI) {
    normalized += tau;
  }
  return normalized;
}

function toTransform(player: MatchPlayerState): { x: number; y: number; z: number; rotationY: number } {
  return {
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY
  };
}

function horizontalDistanceSquared(
  left: { x: number; z: number },
  right: { x: number; z: number }
): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

function resolveMovementDirectionFromDelta(
  deltaX: number,
  deltaZ: number,
  rotationY: number
): MovementDirection {
  const forwardX = Math.sin(rotationY);
  const forwardZ = Math.cos(rotationY);
  const rightX = forwardZ;
  const rightZ = -forwardX;

  const forwardComponent = deltaX * forwardX + deltaZ * forwardZ;
  const rightComponent = deltaX * rightX + deltaZ * rightZ;

  if (Math.abs(forwardComponent) >= Math.abs(rightComponent)) {
    return forwardComponent >= 0 ? "forward" : "backward";
  }

  return rightComponent >= 0 ? "right" : "left";
}

function resolveAnimationGameplayState(options: {
  previousPosition: { x: number; y: number; z: number };
  currentPosition: { x: number; y: number; z: number };
  previousAnimationState: AnimationGameplayState;
  rotationY: number;
  isAlive: boolean;
  isSprinting: boolean;
  locomotionState: MatchPlayerState["locomotionState"];
  isCrouching: boolean;
  isSliding: boolean;
  isWallRunning: boolean;
  isBlocking: boolean;
  attackComboIndex: 0 | 1 | 2 | 3;
  isStunned: boolean;
  isUltimateActive: boolean;
}): AnimationGameplayState {
  if (!options.isAlive) {
    return {
      ...createDefaultAnimationGameplayState(),
      isDead: true,
      locomotionState: "Dead"
    };
  }

  const deltaX = options.currentPosition.x - options.previousPosition.x;
  const deltaY = options.currentPosition.y - options.previousPosition.y;
  const deltaZ = options.currentPosition.z - options.previousPosition.z;

  const horizontalDistance = horizontalDistanceSquared(options.previousPosition, options.currentPosition);
  const movementThreshold = options.previousAnimationState.isMoving
    ? MOVEMENT_STOP_EPSILON_SQUARED
    : MOVEMENT_START_EPSILON_SQUARED;
  const replicatedMovingState =
    options.locomotionState === "Walk" ||
    options.locomotionState === "Run" ||
    options.locomotionState === "CrouchWalk" ||
    options.locomotionState === "Slide" ||
    options.locomotionState === "WallRun";
  const isMoving = replicatedMovingState || horizontalDistance >= movementThreshold;

  let movementDirection: MovementDirection = "none";
  if (isMoving) {
    const shouldKeepPreviousDirection =
      options.previousAnimationState.isMoving &&
      options.previousAnimationState.movementDirection !== "none" &&
      horizontalDistance <= MOVEMENT_DIRECTION_STICKY_EPSILON_SQUARED;

    movementDirection = shouldKeepPreviousDirection
      ? options.previousAnimationState.movementDirection
      : resolveMovementDirectionFromDelta(deltaX, deltaZ, options.rotationY);
  }

  const isBlocking = options.isBlocking && options.attackComboIndex === 0;
  const isHitReacting = options.isStunned && !isBlocking && options.attackComboIndex === 0;
  const isJumping =
    options.locomotionState === "JumpStart" ||
    options.locomotionState === "InAir" ||
    options.locomotionState === "Fall" ||
    options.locomotionState === "DoubleJump" ||
    options.locomotionState === "WallRun" ||
    Math.abs(deltaY) >= VERTICAL_MOVEMENT_EPSILON;
  const locomotionState = options.locomotionState;

  return {
    isDead: false,
    isMoving,
    movementDirection,
    isSprinting: options.isSprinting || locomotionState === "Run",
    isJumping,
    isCrouching:
      options.isCrouching || locomotionState === "Crouch" || locomotionState === "CrouchWalk",
    isSliding: options.isSliding || locomotionState === "Slide",
    isWallRunning: options.isWallRunning || locomotionState === "WallRun",
    isUltimateActive: options.isUltimateActive,
    isBlocking,
    attackComboIndex: options.attackComboIndex,
    isHitReacting,
    locomotionState
  };
}

function resolveSafeAttackComboIndex(player: MatchPlayerState): 0 | 1 | 2 | 3 {
  if (!player.isAttacking) {
    return 0;
  }

  const comboIndex = Math.max(1, Math.min(3, Math.floor(player.attackComboIndex)));
  return comboIndex as 1 | 2 | 3;
}

export type CreateRemotePlayerViewOptions = {
  scene: Scene;
  player: MatchPlayerState;
  role: PlayerViewRole;
  visualStyle: PlayerVisualStyle;
};

export function createRemotePlayerView(options: CreateRemotePlayerViewOptions): RemotePlayerView {
  const entity: MatchPlayerEntity = createMatchPlayerEntity({
    scene: options.scene,
    player: options.player,
    accentColorHex: options.visualStyle.accentColorHex,
    labelColorHex: options.visualStyle.labelColorHex,
    labelPrefix: options.visualStyle.labelPrefix
  });

  entity.setTransform(toTransform(options.player));
  entity.setAnimationGameplayState(createDefaultAnimationGameplayState());

  let animationGameplayState = createDefaultAnimationGameplayState();
  let lastMovementAtMs = Date.now();
  let lastStateSyncAtMs = Date.now();
  let jumpAnimationGraceUntilMs = 0;
  let sprintAnimationGraceUntilMs = 0;
  let attackAnimationGraceUntilMs = 0;
  let landAnimationGraceUntilMs = 0;
  let lastAttackComboIndex: 1 | 2 | 3 = 1;
  let remoteTargetTransform = toTransform(options.player);
  let lastTickAtMs = Date.now();

  const updateFromState = (
    player: MatchPlayerState,
    animationOverride?: AnimationGameplayState
  ): void => {
    const previousPosition = view.lastKnownPosition;
    const transform = toTransform(player);
    if (options.role === "local") {
      entity.setTransform(transform);
    } else {
      remoteTargetTransform = transform;
    }

    if (view.nickname !== player.nickname) {
      entity.setNickname(player.nickname);
      view.nickname = player.nickname;
    }

    if (view.heroId !== player.heroId) {
      entity.applyHeroConfig(player.heroId);
      view.heroId = player.heroId;
    }

    const shouldKeepLocalPredictedAnimation = options.role === "local" && !animationOverride;
    const nowMs = Date.now();

    const serverAttackComboIndex = resolveSafeAttackComboIndex(player);
    const serverIsStunned = nowMs < player.stunUntil;

    const nextAnimationGameplayState: AnimationGameplayState = shouldKeepLocalPredictedAnimation
      ? animationGameplayState
      : animationOverride
        ? {
            isDead: animationOverride.isDead,
            isMoving: animationOverride.isMoving,
            movementDirection: animationOverride.movementDirection,
            isSprinting: animationOverride.isSprinting,
            isJumping: animationOverride.isJumping,
            isCrouching: animationOverride.isCrouching,
            isSliding: animationOverride.isSliding,
            isWallRunning: animationOverride.isWallRunning,
            isUltimateActive: animationOverride.isUltimateActive,
            isBlocking: animationOverride.isBlocking,
            attackComboIndex: animationOverride.attackComboIndex,
            isHitReacting: animationOverride.isHitReacting,
            locomotionState: animationOverride.locomotionState
          }
        : resolveAnimationGameplayState({
            previousPosition,
            currentPosition: transform,
            previousAnimationState: animationGameplayState,
            rotationY: transform.rotationY,
            isAlive: player.isAlive,
            isSprinting: player.isSprinting,
            locomotionState: player.locomotionState,
            isCrouching: player.isCrouching,
            isSliding: player.isSliding,
            isWallRunning: player.isWallRunning,
            isBlocking: player.isBlocking,
            attackComboIndex: serverAttackComboIndex,
            isStunned: serverIsStunned,
            isUltimateActive: player.isUsingUltimate
          });

    if (!shouldKeepLocalPredictedAnimation) {
      if (animationOverride) {
        jumpAnimationGraceUntilMs = 0;
        sprintAnimationGraceUntilMs = 0;
        attackAnimationGraceUntilMs = 0;
        landAnimationGraceUntilMs = 0;
      } else if (!player.isAlive) {
        jumpAnimationGraceUntilMs = 0;
        sprintAnimationGraceUntilMs = 0;
        attackAnimationGraceUntilMs = 0;
        landAnimationGraceUntilMs = 0;
      } else {
        const verticalDelta = transform.y - previousPosition.y;
        if (verticalDelta >= VERTICAL_MOVEMENT_EPSILON) {
          jumpAnimationGraceUntilMs = nowMs + JUMP_ANIMATION_GRACE_MS;
        }
        if (player.isSprinting) {
          sprintAnimationGraceUntilMs = nowMs + SPRINT_ANIMATION_GRACE_MS;
        }
        if (serverAttackComboIndex > 0) {
          attackAnimationGraceUntilMs = nowMs + ATTACK_ANIMATION_GRACE_MS;
          lastAttackComboIndex = serverAttackComboIndex as 1 | 2 | 3;
        }

        if (
          !nextAnimationGameplayState.isJumping &&
          (animationGameplayState.isJumping || nowMs < jumpAnimationGraceUntilMs)
        ) {
          landAnimationGraceUntilMs = nowMs + 110;
        }
      }

      const shouldKeepAttackGrace = nowMs < attackAnimationGraceUntilMs && !player.isBlocking;
      nextAnimationGameplayState.attackComboIndex =
        nextAnimationGameplayState.attackComboIndex > 0
          ? nextAnimationGameplayState.attackComboIndex
          : shouldKeepAttackGrace
            ? lastAttackComboIndex
            : 0;

      nextAnimationGameplayState.isJumping =
        nextAnimationGameplayState.isJumping || nowMs < jumpAnimationGraceUntilMs;
      nextAnimationGameplayState.isSprinting =
        nextAnimationGameplayState.isSprinting || nowMs < sprintAnimationGraceUntilMs;
      if (
        !nextAnimationGameplayState.isCrouching &&
        !nextAnimationGameplayState.isSliding &&
        !nextAnimationGameplayState.isWallRunning
      ) {
        nextAnimationGameplayState.locomotionState = nextAnimationGameplayState.isJumping
          ? "InAir"
          : nowMs < landAnimationGraceUntilMs
            ? "Land"
            : !nextAnimationGameplayState.isMoving
              ? "Idle"
              : nextAnimationGameplayState.isSprinting
                ? "Run"
                : "Walk";
      }

      if (nextAnimationGameplayState.isMoving) {
        lastMovementAtMs = nowMs;
      }

      animationGameplayState = nextAnimationGameplayState;
      entity.setAnimationGameplayState(animationGameplayState);
    }

    lastStateSyncAtMs = nowMs;

    view.lastKnownPosition = {
      x: transform.x,
      y: transform.y,
      z: transform.z
    };
    view.lastKnownRotationY = transform.rotationY;
  };

  const view: RemotePlayerView = {
    sessionId: options.player.sessionId,
    gameplayRoot: entity.gameplayRoot,
    collisionBody: entity.collisionBody,
    groundCheck: entity.groundCheck,
    wallCheckLeft: entity.wallCheckLeft,
    wallCheckRight: entity.wallCheckRight,
    visualRoot: entity.visualRoot,
    audioRoot: entity.audioRoot,
    cameraTargetAnchor: entity.cameraTargetAnchor,
    nameplateNode: entity.nameplateNode,
    role: options.role,
    nickname: options.player.nickname,
    heroId: options.player.heroId,
    lastKnownPosition: {
      x: options.player.x,
      y: options.player.y,
      z: options.player.z
    },
    lastKnownRotationY: options.player.rotationY,
    updateFromState,
    tick: (nowMs) => {
      if (options.role === "local") {
        return;
      }

      const deltaMs = Math.max(1, Math.min(REMOTE_MAX_TICK_DELTA_MS, nowMs - lastTickAtMs));
      lastTickAtMs = nowMs;
      const positionLerpFactor = resolveExponentialLerpFactor(deltaMs, REMOTE_POSITION_SMOOTH_TIME_MS);
      const rotationLerpFactor = resolveExponentialLerpFactor(deltaMs, REMOTE_ROTATION_SMOOTH_TIME_MS);

      const currentTransform = entity.getTransform();
      const dx = remoteTargetTransform.x - currentTransform.x;
      const dy = remoteTargetTransform.y - currentTransform.y;
      const dz = remoteTargetTransform.z - currentTransform.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;

      const deltaRotation = normalizeAngleRadians(remoteTargetTransform.rotationY - currentTransform.rotationY);
      const shouldSnap = distanceSquared >= REMOTE_SNAP_DISTANCE_SQUARED;
      if (shouldSnap) {
        entity.setTransform(remoteTargetTransform);
      } else if (distanceSquared > 0.000001 || Math.abs(deltaRotation) > 0.0005) {
        entity.setTransform({
          x: lerp(currentTransform.x, remoteTargetTransform.x, positionLerpFactor),
          y: lerp(currentTransform.y, remoteTargetTransform.y, positionLerpFactor),
          z: lerp(currentTransform.z, remoteTargetTransform.z, positionLerpFactor),
          rotationY: currentTransform.rotationY + deltaRotation * rotationLerpFactor
        });
      }

      if (!animationGameplayState.isMoving) {
        return;
      }

      const timeSinceMovementMs = nowMs - lastMovementAtMs;
      const timeSinceStateSyncMs = nowMs - lastStateSyncAtMs;
      if (timeSinceMovementMs < REMOTE_IDLE_TIMEOUT_MS || timeSinceStateSyncMs < REMOTE_IDLE_TIMEOUT_MS) {
        return;
      }

      animationGameplayState = {
        isDead: false,
        isMoving: false,
        movementDirection: "none",
        isSprinting: false,
        isJumping: false,
        isCrouching: false,
        isSliding: false,
        isWallRunning: false,
        isUltimateActive: false,
        isBlocking: false,
        attackComboIndex: 0,
        isHitReacting: false,
        locomotionState: "Idle"
      };
      entity.setAnimationGameplayState(animationGameplayState);
    },
    playAnimationCommand: (command) => {
      entity.playAnimationCommand(command);
    },
    getTransform: () => {
      return entity.getTransform();
    },
    getCameraTarget: () => {
      const target = entity.getCameraTarget();
      return {
        x: target.x,
        y: target.y,
        z: target.z
      };
    },
    getRuntimeConfig: () => {
      return entity.getRuntimeConfig();
    },
    dispose: () => {
      entity.dispose();
    }
  };

  return view;
}
