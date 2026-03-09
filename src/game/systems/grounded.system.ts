// Responsável por detectar grounded de forma estável via raycast descendente com histerese.
import { Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { PlayerPhysicsConfig } from "../physics/player-physics";

export type GroundedFrameInput = {
  position: { x: number; y: number; z: number };
  wasGrounded: boolean;
};

export type GroundedFrameResult = {
  isGrounded: boolean;
  groundY: number;
  distanceToGround: number;
  hitMesh: AbstractMesh | null;
};

export type GroundedSystem = {
  detect: (input: GroundedFrameInput) => GroundedFrameResult;
};

export type CreateGroundedSystemOptions = {
  scene: Scene;
  physicsConfig: PlayerPhysicsConfig;
  isGroundMesh: (mesh: AbstractMesh) => boolean;
  rayOriginOffsetY?: number;
};

const UPWARD_GROUND_TOLERANCE = 0.04;
const MIN_GROUND_NORMAL_Y = 0.2;

export function createGroundedSystem(options: CreateGroundedSystemOptions): GroundedSystem {
  const downDirection = new Vector3(0, -1, 0);
  const ray = new Ray(Vector3.Zero(), downDirection, options.physicsConfig.groundedRayLength);
  const rayOriginOffsetY = options.rayOriginOffsetY ?? 1.05;

  return {
    detect: (input) => {
      ray.origin.set(input.position.x, input.position.y + rayOriginOffsetY, input.position.z);
      ray.length = options.physicsConfig.groundedRayLength;

      const hit = options.scene.pickWithRay(
        ray,
        (mesh) => {
          return options.isGroundMesh(mesh);
        },
        false
      );

      if (!hit?.hit || !hit.pickedPoint || !hit.pickedMesh) {
        return {
          isGrounded: false,
          groundY: input.position.y,
          distanceToGround: Number.POSITIVE_INFINITY,
          hitMesh: null
        };
      }

      const normal = hit.getNormal(true);
      if (normal && normal.y < MIN_GROUND_NORMAL_Y) {
        return {
          isGrounded: false,
          groundY: hit.pickedPoint.y,
          distanceToGround: Number.POSITIVE_INFINITY,
          hitMesh: hit.pickedMesh
        };
      }

      const distanceToGround = input.position.y - hit.pickedPoint.y;
      const threshold = input.wasGrounded
        ? options.physicsConfig.groundedStickDistance
        : options.physicsConfig.groundedSnapDistance;
      const minDistance = -UPWARD_GROUND_TOLERANCE;
      const isGrounded = distanceToGround >= minDistance && distanceToGround <= threshold;

      return {
        isGrounded,
        groundY: hit.pickedPoint.y,
        distanceToGround,
        hitMesh: hit.pickedMesh
      };
    }
  };
}
