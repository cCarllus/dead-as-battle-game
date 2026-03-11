// Responsável por detectar chão estável com slope info e histerese para a fundação de locomoção.
import { Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";

export type GroundedFrameInput = {
  position: { x: number; y: number; z: number };
  wasGrounded: boolean;
};

export type GroundedFrameResult = {
  isGrounded: boolean;
  groundY: number;
  distanceToGround: number;
  slopeAngleDegrees: number;
  groundNormal: Vector3 | null;
  hitMesh: AbstractMesh | null;
};

export type GroundedSystem = {
  detect: (input: GroundedFrameInput) => GroundedFrameResult;
};

export type CreateGroundedSystemOptions = {
  scene: Scene;
  runtimeConfig: CharacterRuntimeConfig;
  isGroundMesh: (mesh: AbstractMesh) => boolean;
};

const UPWARD_GROUND_TOLERANCE = 0.04;

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function createGroundedSystem(options: CreateGroundedSystemOptions): GroundedSystem {
  const downDirection = new Vector3(0, -1, 0);
  const ray = new Ray(Vector3.Zero(), downDirection, options.runtimeConfig.locomotion.groundedRayLength);
  const rayOriginOffsetY = options.runtimeConfig.wallCheckOffsetY;
  const slopeLimitDegrees = options.runtimeConfig.locomotion.slopeLimitDegrees;

  return {
    detect: (input) => {
      ray.origin.set(input.position.x, input.position.y + rayOriginOffsetY, input.position.z);
      ray.length = options.runtimeConfig.locomotion.groundedRayLength;

      const hit = options.scene.pickWithRay(
        ray,
        (mesh) => options.isGroundMesh(mesh),
        false
      );

      if (!hit?.hit || !hit.pickedPoint || !hit.pickedMesh) {
        return {
          isGrounded: false,
          groundY: input.position.y,
          distanceToGround: Number.POSITIVE_INFINITY,
          slopeAngleDegrees: 90,
          groundNormal: null,
          hitMesh: null
        };
      }

      const normal = hit.getNormal(true) ?? Vector3.UpReadOnly.clone();
      const normalY = Math.max(-1, Math.min(1, normal.y));
      const slopeAngleDegrees = toDegrees(Math.acos(normalY));
      const isSlopeWalkable = slopeAngleDegrees <= slopeLimitDegrees;
      const distanceToGround = input.position.y - hit.pickedPoint.y;
      const threshold = input.wasGrounded
        ? options.runtimeConfig.locomotion.groundedStickDistance
        : options.runtimeConfig.locomotion.groundedSnapDistance;
      const isGrounded =
        isSlopeWalkable &&
        distanceToGround >= -UPWARD_GROUND_TOLERANCE &&
        distanceToGround <= threshold;

      return {
        isGrounded,
        groundY: hit.pickedPoint.y,
        distanceToGround,
        slopeAngleDegrees,
        groundNormal: normal,
        hitMesh: hit.pickedMesh
      };
    }
  };
}

