// Responsável por integrar deslocamento de gameplay com colisão, priorizando Physics Character Controller quando disponível.
import { Vector3, type AbstractMesh, type Scene, type TransformNode } from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";
import {
  resolveColliderProfileConfig,
  type CharacterColliderProfileName
} from "../character/character-collider-config";
import type {
  CharacterControllerAdapter,
  CharacterControllerGroundInfo
} from "../physics/character-controller-adapter";

export type CollisionMoveResult = {
  transform: { x: number; y: number; z: number; rotationY: number };
  appliedDisplacement: Vector3;
  didCollide: boolean;
};

export type CollisionSystem = {
  configureStaticMeshes: (meshes: AbstractMesh[]) => void;
  setColliderHeight: (height: number, radius?: number, centerY?: number) => void;
  setColliderProfile: (profileName: CharacterColliderProfileName) => void;
  syncToTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
  getGroundInfo: () => CharacterControllerGroundInfo | null;
  getCurrentVelocity: () => Vector3;
  getActiveColliderProfile: () => CharacterColliderProfileName | "custom" | "legacy";
  getDebugState: () => {
    gameplayRootPosition: Vector3;
    ellipsoid: Vector3;
    ellipsoidOffset: Vector3;
    activeColliderProfile: CharacterColliderProfileName | "custom" | "legacy";
    velocity: Vector3;
  };
  moveAndSlide: (desiredDisplacement: Vector3) => CollisionMoveResult;
  dispose: () => void;
};

export type CreateCollisionSystemOptions = {
  scene: Scene;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  runtimeConfig: CharacterRuntimeConfig;
  characterControllerAdapter?: CharacterControllerAdapter | null;
};

const COLLISION_COMPARE_EPSILON = 0.00001;

function isNearlyEqual(left: number, right: number, epsilon = COLLISION_COMPARE_EPSILON): boolean {
  return Math.abs(left - right) <= epsilon;
}

export function createCollisionSystem(options: CreateCollisionSystemOptions): CollisionSystem {
  const standingCollider = options.runtimeConfig.collider.standing;
  options.scene.collisionsEnabled = true;
  options.collisionBody.checkCollisions = true;
  options.collisionBody.isPickable = false;
  options.collisionBody.position.y = standingCollider.centerY;
  options.collisionBody.scaling.set(1, 1, 1);
  options.collisionBody.ellipsoid = new Vector3(
    standingCollider.radius,
    Math.max(0.001, standingCollider.height * 0.5 - standingCollider.radius),
    standingCollider.radius
  );
  options.collisionBody.ellipsoidOffset = Vector3.Zero();

  const configuredStaticMeshIds = new Set<number>();
  const adapter = options.characterControllerAdapter ?? null;
  let legacyLastVelocity = Vector3.Zero();

  const applyLegacyColliderDimensions = (
    height: number,
    radius = standingCollider.radius,
    centerY?: number
  ): void => {
    const safeHeight = Math.max(radius * 2 + 0.1, height);
    const halfHeight = safeHeight * 0.5 - radius;
    const targetCenterY = centerY ?? safeHeight * 0.5;
    options.collisionBody.ellipsoid = new Vector3(radius, halfHeight, radius);
    options.collisionBody.ellipsoidOffset = Vector3.Zero();
    options.collisionBody.position.y = targetCenterY;
    options.collisionBody.scaling.set(
      radius / Math.max(0.001, standingCollider.radius),
      safeHeight / Math.max(0.001, standingCollider.height),
      radius / Math.max(0.001, standingCollider.radius)
    );
  };

  const resolveTransform = (): CollisionMoveResult["transform"] => {
    return {
      x: options.gameplayRoot.position.x,
      y: options.gameplayRoot.position.y,
      z: options.gameplayRoot.position.z,
      rotationY: options.gameplayRoot.rotation.y
    };
  };

  return {
    configureStaticMeshes: (meshes) => {
      meshes.forEach((mesh) => {
        if (mesh.isDisposed()) {
          return;
        }

        if (!configuredStaticMeshIds.has(mesh.uniqueId)) {
          configuredStaticMeshIds.add(mesh.uniqueId);
        }

        if (!adapter) {
          mesh.checkCollisions = true;
        }
        mesh.isPickable = true;
      });
    },
    setColliderHeight: (height, radius = standingCollider.radius, centerY) => {
      if (adapter) {
        adapter.setColliderDimensions(height, radius, centerY);
      }
      applyLegacyColliderDimensions(height, radius, centerY);
    },
    setColliderProfile: (profileName) => {
      if (adapter) {
        adapter.setColliderProfile(profileName);
      }

      if (!adapter) {
        const profile = resolveColliderProfileConfig(options.runtimeConfig.collider, profileName);
        applyLegacyColliderDimensions(profile.height, profile.radius, profile.centerY);
      }
    },
    syncToTransform: (transform) => {
      options.gameplayRoot.position.set(transform.x, transform.y, transform.z);
      options.gameplayRoot.rotation.y = transform.rotationY;
      adapter?.syncToTransform(transform);
    },
    getGroundInfo: () => {
      return adapter?.getGroundInfo() ?? null;
    },
    getCurrentVelocity: () => {
      return adapter?.getCurrentVelocity() ?? legacyLastVelocity.clone();
    },
    getActiveColliderProfile: () => {
      return adapter?.getActiveProfileName() ?? "legacy";
    },
    getDebugState: () => {
      const colliderCenterOffset = options.collisionBody.position.add(options.collisionBody.ellipsoidOffset);
      return {
        gameplayRootPosition: options.gameplayRoot.position.clone(),
        ellipsoid: options.collisionBody.ellipsoid.clone(),
        ellipsoidOffset: colliderCenterOffset,
        activeColliderProfile: adapter?.getActiveProfileName() ?? "legacy",
        velocity: adapter?.getCurrentVelocity() ?? legacyLastVelocity.clone()
      };
    },
    moveAndSlide: (desiredDisplacement) => {
      if (adapter) {
        const beforePosition = options.gameplayRoot.position.clone();
        const controllerResult = adapter.moveWithDisplacement(desiredDisplacement);
        const appliedDisplacement = controllerResult.appliedDisplacement.clone();
        legacyLastVelocity = controllerResult.velocity.clone();

        const didCollide =
          !isNearlyEqual(appliedDisplacement.x, desiredDisplacement.x) ||
          !isNearlyEqual(appliedDisplacement.y, desiredDisplacement.y) ||
          !isNearlyEqual(appliedDisplacement.z, desiredDisplacement.z);

        if (
          !isNearlyEqual(beforePosition.x + appliedDisplacement.x, options.gameplayRoot.position.x) ||
          !isNearlyEqual(beforePosition.y + appliedDisplacement.y, options.gameplayRoot.position.y) ||
          !isNearlyEqual(beforePosition.z + appliedDisplacement.z, options.gameplayRoot.position.z)
        ) {
          appliedDisplacement.copyFrom(options.gameplayRoot.position.subtract(beforePosition));
        }

        return {
          transform: resolveTransform(),
          appliedDisplacement,
          didCollide
        };
      }

      const beforeLocalPosition = options.collisionBody.position.clone();
      options.collisionBody.moveWithCollisions(desiredDisplacement);
      const appliedDisplacement = options.collisionBody.position.subtract(beforeLocalPosition);
      options.gameplayRoot.position.addInPlace(appliedDisplacement);
      options.collisionBody.position.copyFrom(beforeLocalPosition);

      const deltaSeconds = Math.max(1 / 240, options.scene.getEngine().getDeltaTime() / 1000);
      legacyLastVelocity = appliedDisplacement.scale(1 / deltaSeconds);

      const didCollide =
        !isNearlyEqual(appliedDisplacement.x, desiredDisplacement.x) ||
        !isNearlyEqual(appliedDisplacement.y, desiredDisplacement.y) ||
        !isNearlyEqual(appliedDisplacement.z, desiredDisplacement.z);

      return {
        transform: resolveTransform(),
        appliedDisplacement,
        didCollide
      };
    },
    dispose: () => {
      options.collisionBody.checkCollisions = false;
      configuredStaticMeshIds.clear();
      adapter?.dispose();
    }
  };
}
