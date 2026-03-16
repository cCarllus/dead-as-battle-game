// Responsible for keeping the shoulder camera in front of walls by ray-testing the camera path.
import { Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";

export type CameraCollisionResolveInput = {
  origin: Vector3;
  desiredPosition: Vector3;
  right: Vector3;
  up: Vector3;
  collisionRadius: number;
  collisionBuffer: number;
  minDistance: number;
};

export type CameraCollisionResolveOutput = {
  position: Vector3;
  hasHit: boolean;
  hitDistance: number;
  desiredDistance: number;
  hitPoint: Vector3 | null;
};

export type CameraCollisionSystem = {
  resolve: (input: CameraCollisionResolveInput) => CameraCollisionResolveOutput;
  dispose: () => void;
};

function canCollideWithCamera(mesh: AbstractMesh | null): mesh is AbstractMesh {
  return !!mesh && !mesh.isDisposed() && mesh.isEnabled() && mesh.isPickable && mesh.checkCollisions;
}

function buildSampleOrigins(
  origin: Vector3,
  right: Vector3,
  up: Vector3,
  radius: number
): Vector3[] {
  if (radius <= 0.0001) {
    return [origin.clone()];
  }

  return [
    origin.clone(),
    origin.add(right.scale(radius)),
    origin.subtract(right.scale(radius)),
    origin.add(up.scale(radius)),
    origin.subtract(up.scale(radius))
  ];
}

export function createCameraCollisionSystem(scene: Scene): CameraCollisionSystem {
  return {
    resolve: (input) => {
      const offset = input.desiredPosition.subtract(input.origin);
      const desiredDistance = offset.length();
      if (desiredDistance <= 0.0001) {
        return {
          position: input.origin.clone(),
          hasHit: false,
          hitDistance: 0,
          desiredDistance: 0,
          hitPoint: null
        };
      }

      const direction = offset.scale(1 / desiredDistance);
      const sampleOrigins = buildSampleOrigins(
        input.origin,
        input.right.normalizeToNew(),
        input.up.normalizeToNew(),
        input.collisionRadius
      );

      let nearestHitDistance = Number.POSITIVE_INFINITY;
      let nearestHitPoint: Vector3 | null = null;

      sampleOrigins.forEach((sampleOrigin) => {
        const ray = new Ray(sampleOrigin, direction, desiredDistance);
        const hit = scene.pickWithRay(ray, canCollideWithCamera, false);
        if (!hit?.hit || !Number.isFinite(hit.distance)) {
          return;
        }

        if (hit.distance < nearestHitDistance) {
          nearestHitDistance = hit.distance;
          nearestHitPoint = hit.pickedPoint?.clone() ?? null;
        }
      });

      if (!Number.isFinite(nearestHitDistance)) {
        return {
          position: input.desiredPosition.clone(),
          hasHit: false,
          hitDistance: desiredDistance,
          desiredDistance,
          hitPoint: null
        };
      }

      const resolvedDistance = Math.max(
        input.minDistance,
        Math.min(desiredDistance, nearestHitDistance - input.collisionBuffer)
      );

      return {
        position: input.origin.add(direction.scale(resolvedDistance)),
        hasHit: true,
        hitDistance: resolvedDistance,
        desiredDistance,
        hitPoint: nearestHitPoint ?? input.origin.add(direction.scale(nearestHitDistance))
      };
    },
    dispose: () => {}
  };
}
