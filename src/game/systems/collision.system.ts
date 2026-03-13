// Responsável por integrar deslocamento gameplay com colisão de mundo usando moveWithCollisions no capsule local.
import { Vector3, type AbstractMesh, type Scene, type TransformNode } from "@babylonjs/core";

export type CollisionMoveResult = {
  transform: { x: number; y: number; z: number; rotationY: number };
  appliedDisplacement: Vector3;
  didCollide: boolean;
};

export type CollisionSystem = {
  configureStaticMeshes: (meshes: AbstractMesh[]) => void;
  setColliderHeight: (height: number, radius?: number, centerY?: number) => void;
  getDebugState: () => {
    gameplayRootPosition: Vector3;
    ellipsoid: Vector3;
    ellipsoidOffset: Vector3;
  };
  moveAndSlide: (desiredDisplacement: Vector3) => CollisionMoveResult;
  dispose: () => void;
};

export type CreateCollisionSystemOptions = {
  scene: Scene;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
};

const COLLISION_COMPARE_EPSILON = 0.00001;
const DEFAULT_COLLIDER_RADIUS = 0.42;

export function createCollisionSystem(options: CreateCollisionSystemOptions): CollisionSystem {
  options.scene.collisionsEnabled = true;
  options.collisionBody.checkCollisions = true;
  options.collisionBody.isPickable = false;
  options.collisionBody.ellipsoid = new Vector3(DEFAULT_COLLIDER_RADIUS, 1.18, DEFAULT_COLLIDER_RADIUS);
  options.collisionBody.ellipsoidOffset = new Vector3(0, 1.18, 0);

  const configuredStaticMeshIds = new Set<number>();

  return {
    configureStaticMeshes: (meshes) => {
      meshes.forEach((mesh) => {
        if (mesh.isDisposed()) {
          return;
        }

        if (!configuredStaticMeshIds.has(mesh.uniqueId)) {
          configuredStaticMeshIds.add(mesh.uniqueId);
        }

        mesh.checkCollisions = true;
        mesh.isPickable = true;
      });
    },
    setColliderHeight: (height, radius = DEFAULT_COLLIDER_RADIUS, centerY) => {
      const safeHeight = Math.max(radius * 2 + 0.1, height);
      const halfHeight = safeHeight * 0.5 - radius;
      options.collisionBody.ellipsoid = new Vector3(radius, halfHeight, radius);
      options.collisionBody.ellipsoidOffset = new Vector3(0, centerY ?? halfHeight, 0);
    },
    getDebugState: () => {
      return {
        gameplayRootPosition: options.gameplayRoot.position.clone(),
        ellipsoid: options.collisionBody.ellipsoid.clone(),
        ellipsoidOffset: options.collisionBody.ellipsoidOffset.clone()
      };
    },
    moveAndSlide: (desiredDisplacement) => {
      const beforeLocalPosition = options.collisionBody.position.clone();

      options.collisionBody.moveWithCollisions(desiredDisplacement);

      const appliedDisplacement = options.collisionBody.position.subtract(beforeLocalPosition);
      options.gameplayRoot.position.addInPlace(appliedDisplacement);
      options.collisionBody.position.copyFrom(beforeLocalPosition);

      const didCollide =
        Math.abs(appliedDisplacement.x - desiredDisplacement.x) > COLLISION_COMPARE_EPSILON ||
        Math.abs(appliedDisplacement.y - desiredDisplacement.y) > COLLISION_COMPARE_EPSILON ||
        Math.abs(appliedDisplacement.z - desiredDisplacement.z) > COLLISION_COMPARE_EPSILON;

      return {
        transform: {
          x: options.gameplayRoot.position.x,
          y: options.gameplayRoot.position.y,
          z: options.gameplayRoot.position.z,
          rotationY: options.gameplayRoot.rotation.y
        },
        appliedDisplacement,
        didCollide
      };
    },
    dispose: () => {
      options.collisionBody.checkCollisions = false;
      configuredStaticMeshIds.clear();
    }
  };
}
