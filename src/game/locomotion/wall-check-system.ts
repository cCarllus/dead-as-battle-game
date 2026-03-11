// Responsável por executar side checks de parede usando anchors fixos do runtime de personagem.
import { Ray, Vector3, type AbstractMesh, type Scene, type TransformNode } from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";

export type WallCheckHit = {
  side: "left" | "right";
  isHit: boolean;
  isRunnable: boolean;
  distance: number;
  hitPoint: Vector3 | null;
  normal: Vector3 | null;
  mesh: AbstractMesh | null;
};

export type WallCheckResult = {
  left: WallCheckHit;
  right: WallCheckHit;
  dominant: WallCheckHit | null;
};

export type WallCheckSystem = {
  detect: (input: { rotationY: number; desiredDirection: Vector3 }) => WallCheckResult;
};

export type CreateWallCheckSystemOptions = {
  scene: Scene;
  runtimeConfig: CharacterRuntimeConfig;
  wallCheckLeft: TransformNode;
  wallCheckRight: TransformNode;
  isWallMesh: (mesh: AbstractMesh) => boolean;
};

function createMiss(side: "left" | "right"): WallCheckHit {
  return {
    side,
    isHit: false,
    isRunnable: false,
    distance: Number.POSITIVE_INFINITY,
    hitPoint: null,
    normal: null,
    mesh: null
  };
}

function resolveSideDirection(rotationY: number, side: "left" | "right"): Vector3 {
  const forwardX = Math.sin(rotationY);
  const forwardZ = Math.cos(rotationY);
  const leftX = -forwardZ;
  const leftZ = forwardX;
  const direction = side === "left"
    ? new Vector3(leftX, 0, leftZ)
    : new Vector3(-leftX, 0, -leftZ);

  return direction.normalize();
}

function scoreWallHit(hit: WallCheckHit, desiredDirection: Vector3): number {
  if (!hit.isRunnable || !hit.normal) {
    return Number.NEGATIVE_INFINITY;
  }

  const up = Vector3.UpReadOnly;
  const tangentA = Vector3.Cross(up, hit.normal).normalize();
  const tangentB = tangentA.scale(-1);
  const desired = desiredDirection.lengthSquared() > 0.0001 ? desiredDirection.normalizeToNew() : Vector3.Forward();
  return Math.max(Vector3.Dot(tangentA, desired), Vector3.Dot(tangentB, desired)) - hit.distance * 0.01;
}

export function createWallCheckSystem(options: CreateWallCheckSystemOptions): WallCheckSystem {
  const ray = new Ray(Vector3.Zero(), Vector3.Right(), options.runtimeConfig.locomotion.wallDetectionDistance);

  const detectSide = (side: "left" | "right", anchor: TransformNode, rotationY: number): WallCheckHit => {
    const direction = resolveSideDirection(rotationY, side);
    ray.origin.copyFrom(anchor.getAbsolutePosition());
    ray.direction.copyFrom(direction);
    ray.length = options.runtimeConfig.locomotion.wallDetectionDistance;

    const hit = options.scene.pickWithRay(
      ray,
      (mesh) => options.isWallMesh(mesh),
      false
    );

    if (!hit?.hit || !hit.pickedPoint || !hit.pickedMesh) {
      return createMiss(side);
    }

    const normal = hit.getNormal(true);
    const isRunnable = !!normal && Math.abs(normal.y) <= 0.2;

    return {
      side,
      isHit: true,
      isRunnable,
      distance: hit.distance,
      hitPoint: hit.pickedPoint.clone(),
      normal: normal?.clone() ?? null,
      mesh: hit.pickedMesh
    };
  };

  return {
    detect: (input) => {
      const left = detectSide("left", options.wallCheckLeft, input.rotationY);
      const right = detectSide("right", options.wallCheckRight, input.rotationY);
      const leftScore = scoreWallHit(left, input.desiredDirection);
      const rightScore = scoreWallHit(right, input.desiredDirection);

      return {
        left,
        right,
        dominant:
          leftScore === Number.NEGATIVE_INFINITY && rightScore === Number.NEGATIVE_INFINITY
            ? null
            : leftScore >= rightScore
              ? left
              : right
      };
    }
  };
}

