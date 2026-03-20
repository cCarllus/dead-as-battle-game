// Responsável por encapsular o Physics Character Controller como autoridade de posição lógica, com perfis de collider e API estável para locomoção.
import { Vector3, type AbstractMesh, type TransformNode, type Scene } from "@babylonjs/core";
import {
  CharacterSupportedState,
  PhysicsCharacterController
} from "@babylonjs/core/Physics/v2/characterController";
import { PhysicsShapeCapsule } from "@babylonjs/core/Physics/v2/physicsShape";
import type { CharacterRuntimeConfig } from "../character/character-config";
import {
  resolveColliderProfileConfig,
  type CharacterColliderProfileName
} from "../character/character-collider-config";
import type { ShapeQueryService } from "./shape-query-service";
import { clamp, moveTowards, toRadians } from "../utils/math";

const UP_VECTOR = new Vector3(0, 1, 0);
const DOWN_VECTOR = new Vector3(0, -1, 0);
const ZERO_VECTOR = Vector3.Zero();
const CHARACTER_DT_FALLBACK_SECONDS = 1 / 60;
const CHARACTER_DT_MIN_SECONDS = 1 / 240;

export type CharacterColliderProfile = {
  name: CharacterColliderProfileName;
  height: number;
  radius: number;
  centerY: number;
};

export type CharacterControllerGroundInfo = {
  isGrounded: boolean;
  supportedState: CharacterSupportedState;
  groundNormal: Vector3 | null;
  slopeAngleDegrees: number;
  surfaceVelocity: Vector3;
  isSurfaceDynamic: boolean;
};

export type CharacterControllerWallInfo = {
  hasWall: boolean;
  point: Vector3 | null;
  normal: Vector3 | null;
  distance: number | null;
  meshName: string | null;
};

export type CharacterControllerAdapter = {
  moveWithDisplacement: (desiredDisplacement: Vector3) => {
    appliedDisplacement: Vector3;
    velocity: Vector3;
  };
  moveGround: (inputDirection: Vector3, deltaTime: number, desiredSpeed: number) => void;
  moveAir: (inputDirection: Vector3, deltaTime: number, desiredSpeed: number) => void;
  jump: (verticalImpulse: number, forwardDirection: Vector3, forwardBoost: number) => void;
  syncToTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
  setColliderProfile: (profileName: CharacterColliderProfileName) => void;
  setColliderDimensions: (height: number, radius: number, centerY?: number) => void;
  getGroundInfo: () => CharacterControllerGroundInfo;
  getWallInfo: (forwardDirection: Vector3, distance: number) => CharacterControllerWallInfo;
  getCurrentVelocity: () => Vector3;
  isGrounded: () => boolean;
  getSlopeAngle: () => number;
  getRootPosition: () => Vector3;
  getControllerPosition: () => Vector3;
  getActiveProfileName: () => CharacterColliderProfileName | "custom";
  dispose: () => void;
};

export type CreateCharacterControllerAdapterOptions = {
  scene: Scene;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  runtimeConfig: CharacterRuntimeConfig;
  shapeQueryService?: ShapeQueryService;
};

function resolveSafeDeltaSeconds(scene: Scene): number {
  const rawDeltaSeconds = scene.getEngine().getDeltaTime() / 1000;
  if (!Number.isFinite(rawDeltaSeconds) || rawDeltaSeconds <= 0) {
    return CHARACTER_DT_FALLBACK_SECONDS;
  }

  return Math.max(CHARACTER_DT_MIN_SECONDS, rawDeltaSeconds);
}

function buildCapsuleShape(
  scene: Scene,
  height: number,
  radius: number
): PhysicsShapeCapsule {
  const safeRadius = Math.max(0.05, radius);
  const safeHeight = Math.max(safeRadius * 2 + 0.05, height);
  const segmentHalf = Math.max(0, safeHeight * 0.5 - safeRadius);
  const pointA = new Vector3(0, segmentHalf, 0);
  const pointB = new Vector3(0, -segmentHalf, 0);
  return new PhysicsShapeCapsule(pointA, pointB, safeRadius, scene);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createCharacterControllerAdapter(
  options: CreateCharacterControllerAdapterOptions
): CharacterControllerAdapter {
  const standingProfile = options.runtimeConfig.collider.standing;
  const defaultProfile: CharacterColliderProfile = {
    name: "default",
    height: standingProfile.height,
    radius: standingProfile.radius,
    centerY: standingProfile.centerY
  };

  const profileByName: Record<CharacterColliderProfileName, CharacterColliderProfile> = {
    default: defaultProfile,
    rolling: {
      name: "rolling",
      ...resolveColliderProfileConfig(options.runtimeConfig.collider, "rolling")
    },
    hanging: {
      name: "hanging",
      ...resolveColliderProfileConfig(options.runtimeConfig.collider, "hanging")
    },
    climbingUp: {
      name: "climbingUp",
      ...resolveColliderProfileConfig(options.runtimeConfig.collider, "climbingUp")
    },
    mantle: {
      name: "mantle",
      ...resolveColliderProfileConfig(options.runtimeConfig.collider, "mantle")
    }
  };

  const capsuleShapeCache = new Map<string, PhysicsShapeCapsule>();
  const resolveCapsuleShape = (height: number, radius: number): PhysicsShapeCapsule => {
    const safeHeight = Math.max(0.1, height);
    const safeRadius = Math.max(0.05, radius);
    const shapeKey = `${safeHeight.toFixed(4)}:${safeRadius.toFixed(4)}`;
    const cachedShape = capsuleShapeCache.get(shapeKey);
    if (cachedShape) {
      return cachedShape;
    }

    const createdShape = buildCapsuleShape(options.scene, safeHeight, safeRadius);
    capsuleShapeCache.set(shapeKey, createdShape);
    return createdShape;
  };

  let activeProfileName: CharacterColliderProfileName | "custom" = "default";
  let activeProfile = { ...defaultProfile };

  const initialControllerPosition = new Vector3(
    options.gameplayRoot.position.x,
    options.gameplayRoot.position.y + activeProfile.centerY,
    options.gameplayRoot.position.z
  );

  const characterController = new PhysicsCharacterController(
    initialControllerPosition,
    {
      shape: resolveCapsuleShape(activeProfile.height, activeProfile.radius)
    },
    options.scene
  );
  characterController.maxSlopeCosine = Math.cos(toRadians(options.runtimeConfig.locomotion.slopeLimitDegrees));
  characterController.maxCharacterSpeedForSolver =
    options.runtimeConfig.locomotion.runSpeed *
    options.runtimeConfig.locomotion.sprintBurstSpeedMultiplier *
    1.45;
  characterController.keepDistance = Math.max(0.025, options.runtimeConfig.collider.collisionClearanceY);
  characterController.keepContactTolerance = Math.max(0.06, characterController.keepDistance + 0.04);
  characterController.maxCastIterations = 12;

  let lastVelocity = Vector3.Zero();
  let lastGroundInfo: CharacterControllerGroundInfo = {
    isGrounded: false,
    supportedState: CharacterSupportedState.UNSUPPORTED,
    groundNormal: null,
    slopeAngleDegrees: 90,
    surfaceVelocity: Vector3.Zero(),
    isSurfaceDynamic: false
  };

  const syncCollisionBodyVisual = (): void => {
    const radiusScale = activeProfile.radius / Math.max(0.001, standingProfile.radius);
    const heightScale = activeProfile.height / Math.max(0.001, standingProfile.height);
    options.collisionBody.scaling.set(radiusScale, heightScale, radiusScale);
    options.collisionBody.position.y = activeProfile.centerY;
  };

  const getRootPositionFromController = (): Vector3 => {
    const controllerPosition = characterController.getPosition();
    return new Vector3(
      controllerPosition.x,
      controllerPosition.y - activeProfile.centerY,
      controllerPosition.z
    );
  };

  const syncRootFromController = (): void => {
    const nextRootPosition = getRootPositionFromController();
    options.gameplayRoot.position.copyFrom(nextRootPosition);
  };

  const syncControllerFromRoot = (): void => {
    characterController.setPosition(
      new Vector3(
        options.gameplayRoot.position.x,
        options.gameplayRoot.position.y + activeProfile.centerY,
        options.gameplayRoot.position.z
      )
    );
  };

  const updateGroundInfo = (deltaTime: number): CharacterControllerGroundInfo => {
    const safeDelta = Math.max(CHARACTER_DT_MIN_SECONDS, deltaTime);
    const supportInfo = characterController.checkSupport(safeDelta, DOWN_VECTOR);
    const normal =
      supportInfo.averageSurfaceNormal.lengthSquared() > 0.0001
        ? supportInfo.averageSurfaceNormal.normalizeToNew()
        : null;
    const slopeAngleDegrees = normal
      ? (Math.acos(clamp(Vector3.Dot(normal, UP_VECTOR), -1, 1)) * 180) / Math.PI
      : 90;
    const isGroundedBySupport = supportInfo.supportedState === CharacterSupportedState.SUPPORTED;
    const isGroundedBySlope = slopeAngleDegrees <= options.runtimeConfig.locomotion.slopeLimitDegrees + 0.5;
    const isGrounded = isGroundedBySupport && isGroundedBySlope;

    lastGroundInfo = {
      isGrounded,
      supportedState: supportInfo.supportedState,
      groundNormal: normal,
      slopeAngleDegrees,
      surfaceVelocity: supportInfo.averageSurfaceVelocity.clone(),
      isSurfaceDynamic: supportInfo.isSurfaceDynamic
    };
    return lastGroundInfo;
  };

  const applyVelocityWithIntegration = (
    nextVelocity: Vector3,
    deltaTime: number,
    gravity: Vector3
  ): void => {
    const safeDelta = Math.max(CHARACTER_DT_MIN_SECONDS, deltaTime);
    const supportInfo = characterController.checkSupport(safeDelta, DOWN_VECTOR);
    characterController.setVelocity(nextVelocity);
    characterController.integrate(safeDelta, supportInfo, gravity);
    syncRootFromController();
    lastVelocity = characterController.getVelocity().clone();
    updateGroundInfo(safeDelta);
  };

  const setColliderShape = (
    profileName: CharacterColliderProfileName | "custom",
    height: number,
    radius: number,
    centerY: number
  ): void => {
    const rootBefore = options.gameplayRoot.position.clone();
    activeProfileName = profileName;
    activeProfile = {
      name: profileName === "custom" ? "default" : profileName,
      height,
      radius,
      centerY
    };

    const nextShape = resolveCapsuleShape(height, radius);
    characterController.shape = nextShape;
    characterController.setPosition(new Vector3(rootBefore.x, rootBefore.y + centerY, rootBefore.z));
    syncCollisionBodyVisual();
    updateGroundInfo(resolveSafeDeltaSeconds(options.scene));
  };

  syncCollisionBodyVisual();
  updateGroundInfo(resolveSafeDeltaSeconds(options.scene));

  return {
    moveWithDisplacement: (desiredDisplacement) => {
      syncControllerFromRoot();
      const beforeRoot = options.gameplayRoot.position.clone();
      characterController.moveWithCollisions(desiredDisplacement);
      syncRootFromController();
      const afterRoot = options.gameplayRoot.position.clone();
      const appliedDisplacement = afterRoot.subtract(beforeRoot);
      const safeDelta = resolveSafeDeltaSeconds(options.scene);
      lastVelocity = appliedDisplacement.scale(1 / safeDelta);
      updateGroundInfo(safeDelta);

      return {
        appliedDisplacement,
        velocity: lastVelocity.clone()
      };
    },
    moveGround: (inputDirection, deltaTime, desiredSpeed) => {
      syncControllerFromRoot();
      const safeDelta = Math.max(CHARACTER_DT_MIN_SECONDS, deltaTime);
      const normalizedDirection = inputDirection.lengthSquared() > 0.0001
        ? inputDirection.normalizeToNew()
        : Vector3.Zero();
      // Filosofia herdada do 2D: velocidade alvo + aceleração/desaceleração explícitas para previsibilidade.
      const targetVelocity = normalizedDirection.scale(desiredSpeed);
      const currentVelocity = characterController.getVelocity().clone();
      const nextVelocity = currentVelocity.clone();
      const hasDirection = normalizedDirection.lengthSquared() > 0.0001;
      const accel = hasDirection
        ? options.runtimeConfig.locomotion.acceleration
        : options.runtimeConfig.locomotion.deceleration;
      nextVelocity.x = moveTowards(currentVelocity.x, targetVelocity.x, accel * safeDelta);
      nextVelocity.z = moveTowards(currentVelocity.z, targetVelocity.z, accel * safeDelta);
      if (nextVelocity.y < 0) {
        nextVelocity.y = 0;
      }
      applyVelocityWithIntegration(nextVelocity, safeDelta, ZERO_VECTOR);
    },
    moveAir: (inputDirection, deltaTime, desiredSpeed) => {
      syncControllerFromRoot();
      const safeDelta = Math.max(CHARACTER_DT_MIN_SECONDS, deltaTime);
      const normalizedDirection = inputDirection.lengthSquared() > 0.0001
        ? inputDirection.normalizeToNew()
        : Vector3.Zero();
      // No ar, a mesma filosofia de velocidade alvo é aplicada com aceleração menor (air control reduzido).
      const targetVelocity = normalizedDirection.scale(desiredSpeed);
      const currentVelocity = characterController.getVelocity().clone();
      const nextVelocity = currentVelocity.clone();
      const hasDirection = normalizedDirection.lengthSquared() > 0.0001;
      const accel = hasDirection
        ? options.runtimeConfig.locomotion.airAcceleration
        : options.runtimeConfig.locomotion.airDeceleration;
      nextVelocity.x = moveTowards(currentVelocity.x, targetVelocity.x, accel * safeDelta);
      nextVelocity.z = moveTowards(currentVelocity.z, targetVelocity.z, accel * safeDelta);
      const gravity = new Vector3(0, -options.runtimeConfig.locomotion.gravity, 0);
      applyVelocityWithIntegration(nextVelocity, safeDelta, gravity);
    },
    jump: (verticalImpulse, forwardDirection, forwardBoost) => {
      syncControllerFromRoot();
      const nextVelocity = characterController.getVelocity().clone();
      if (forwardBoost > 0 && forwardDirection.lengthSquared() > 0.0001) {
        const normalizedForward = forwardDirection.normalizeToNew();
        nextVelocity.x += normalizedForward.x * forwardBoost;
        nextVelocity.z += normalizedForward.z * forwardBoost;
      }
      nextVelocity.y = verticalImpulse;
      characterController.setVelocity(nextVelocity);
      lastVelocity = nextVelocity.clone();
    },
    syncToTransform: (transform) => {
      options.gameplayRoot.position.set(transform.x, transform.y, transform.z);
      options.gameplayRoot.rotation.y = transform.rotationY;
      characterController.setPosition(
        new Vector3(
          transform.x,
          transform.y + activeProfile.centerY,
          transform.z
        )
      );
      updateGroundInfo(resolveSafeDeltaSeconds(options.scene));
    },
    setColliderProfile: (profileName) => {
      const profile = profileByName[profileName];
      setColliderShape(profileName, profile.height, profile.radius, profile.centerY);
    },
    setColliderDimensions: (height, radius, centerY) => {
      const safeHeight = Math.max(radius * 2 + 0.05, height);
      const safeRadius = Math.max(0.05, radius);
      const safeCenterY = Number.isFinite(centerY) ? (centerY as number) : safeHeight * 0.5;
      setColliderShape("custom", safeHeight, safeRadius, safeCenterY);
    },
    getGroundInfo: () => {
      return {
        isGrounded: lastGroundInfo.isGrounded,
        supportedState: lastGroundInfo.supportedState,
        groundNormal: lastGroundInfo.groundNormal ? lastGroundInfo.groundNormal.clone() : null,
        slopeAngleDegrees: lastGroundInfo.slopeAngleDegrees,
        surfaceVelocity: lastGroundInfo.surfaceVelocity.clone(),
        isSurfaceDynamic: lastGroundInfo.isSurfaceDynamic
      };
    },
    getWallInfo: (forwardDirection, distance) => {
      if (!options.shapeQueryService || forwardDirection.lengthSquared() <= 0.0001) {
        return {
          hasWall: false,
          point: null,
          normal: null,
          distance: null,
          meshName: null
        };
      }

      const origin = new Vector3(
        options.gameplayRoot.position.x,
        options.gameplayRoot.position.y + options.runtimeConfig.ledge.chestProbeHeight,
        options.gameplayRoot.position.z
      );

      const hit = options.shapeQueryService.detectWallForHang({
        label: "adapter-wall",
        origin,
        direction: forwardDirection.normalizeToNew(),
        length: Math.max(0.05, distance),
        radius: options.runtimeConfig.collider.standing.radius * 0.22,
        predicate: () => true
      });

      return {
        hasWall: hit.hit,
        point: hit.point ? hit.point.clone() : null,
        normal: hit.normal ? hit.normal.clone() : null,
        distance: hit.distance,
        meshName: hit.mesh?.name ?? null
      };
    },
    getCurrentVelocity: () => {
      return lastVelocity.clone();
    },
    isGrounded: () => {
      return lastGroundInfo.isGrounded;
    },
    getSlopeAngle: () => {
      return lastGroundInfo.slopeAngleDegrees;
    },
    getRootPosition: () => {
      return options.gameplayRoot.position.clone();
    },
    getControllerPosition: () => {
      return characterController.getPosition().clone();
    },
    getActiveProfileName: () => {
      return activeProfileName;
    },
    dispose: () => {
      capsuleShapeCache.forEach((shape) => {
        shape.dispose();
      });
      capsuleShapeCache.clear();
      characterController.dispose();
      options.collisionBody.scaling.set(1, 1, 1);
      options.collisionBody.position.y = 0;
      if ((globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown }).__DAB_ADVANCED_MOVEMENT_DEBUG__ === true) {
        console.debug("[physics][character-controller] disposed", {
          profile: activeProfileName,
          velocity: {
            x: round3(lastVelocity.x),
            y: round3(lastVelocity.y),
            z: round3(lastVelocity.z)
          }
        });
      }
    }
  };
}
