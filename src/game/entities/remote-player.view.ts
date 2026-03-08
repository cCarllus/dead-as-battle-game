// Responsável por tipar a view de player desacoplada com gameplayRoot autoritativo e camada visual independente.
import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
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

const MOVEMENT_EPSILON_SQUARED = 0.0004;
const VERTICAL_MOVEMENT_EPSILON = 0.02;
const REMOTE_IDLE_TIMEOUT_MS = 320;

export type PlayerViewRole = "local" | "teammate" | "enemy";

export type RemotePlayerView = {
  sessionId: string;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  visualRoot: TransformNode;
  nameplateNode: AbstractMesh;
  role: PlayerViewRole;
  nickname: string;
  heroId: string;
  lastKnownPosition: { x: number; y: number; z: number };
  lastKnownRotationY: number;
  updateFromState: (player: MatchPlayerState) => void;
  tick: (nowMs: number) => void;
  getTransform: () => { x: number; y: number; z: number; rotationY: number };
  getCameraTarget: () => { x: number; y: number; z: number };
  dispose: () => void;
};

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
  rotationY: number;
  isAlive: boolean;
  isSprinting: boolean;
}): AnimationGameplayState {
  if (!options.isAlive) {
    return createDefaultAnimationGameplayState();
  }

  const deltaX = options.currentPosition.x - options.previousPosition.x;
  const deltaY = options.currentPosition.y - options.previousPosition.y;
  const deltaZ = options.currentPosition.z - options.previousPosition.z;

  const isMoving =
    horizontalDistanceSquared(options.previousPosition, options.currentPosition) >= MOVEMENT_EPSILON_SQUARED;
  const movementDirection = isMoving
    ? resolveMovementDirectionFromDelta(deltaX, deltaZ, options.rotationY)
    : "none";

  return {
    isMoving,
    movementDirection,
    isSprinting: options.isSprinting,
    isJumping: Math.abs(deltaY) >= VERTICAL_MOVEMENT_EPSILON,
    isUltimateActive: false
  };
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

  const updateFromState = (player: MatchPlayerState): void => {
    const previousPosition = view.lastKnownPosition;
    const transform = toTransform(player);
    entity.setTransform(transform);

    if (view.nickname !== player.nickname) {
      entity.setNickname(player.nickname);
      view.nickname = player.nickname;
    }

    if (view.heroId !== player.heroId) {
      entity.applyHeroConfig(player.heroId);
      view.heroId = player.heroId;
    }

    const nextAnimationGameplayState = resolveAnimationGameplayState({
      previousPosition,
      currentPosition: transform,
      rotationY: transform.rotationY,
      isAlive: player.isAlive,
      isSprinting: player.isSprinting
    });

    const nowMs = Date.now();
    if (nextAnimationGameplayState.isMoving) {
      lastMovementAtMs = nowMs;
    }

    lastStateSyncAtMs = nowMs;
    animationGameplayState = nextAnimationGameplayState;
    entity.setAnimationGameplayState(animationGameplayState);

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
    visualRoot: entity.visualRoot,
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

      if (!animationGameplayState.isMoving) {
        return;
      }

      const timeSinceMovementMs = nowMs - lastMovementAtMs;
      const timeSinceStateSyncMs = nowMs - lastStateSyncAtMs;
      if (timeSinceMovementMs < REMOTE_IDLE_TIMEOUT_MS || timeSinceStateSyncMs < REMOTE_IDLE_TIMEOUT_MS) {
        return;
      }

      animationGameplayState = {
        isMoving: false,
        movementDirection: "none",
        isSprinting: false,
        isJumping: false,
        isUltimateActive: false
      };
      entity.setAnimationGameplayState(animationGameplayState);
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
    dispose: () => {
      entity.dispose();
    }
  };

  return view;
}
