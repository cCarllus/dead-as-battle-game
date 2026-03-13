// Responsável por detectar chão estável com slope info e histerese para a fundação de locomoção.
import { Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";
import type { CharacterControllerGroundInfo } from "../physics/character-controller-adapter";

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
  getControllerGroundInfo?: () => CharacterControllerGroundInfo | null;
  getControllerRootPosition?: () => Vector3 | null;
};

const UPWARD_GROUND_TOLERANCE = 0.04;

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function createGroundedSystem(options: CreateGroundedSystemOptions): GroundedSystem {
  const downDirection = new Vector3(0, -1, 0);
  const ray = new Ray(Vector3.Zero(), downDirection, options.runtimeConfig.locomotion.groundedRayLength);
  const rayOriginOffsetY = options.runtimeConfig.anchors.wallCheckOffsetY;
  const slopeLimitDegrees = options.runtimeConfig.locomotion.slopeLimitDegrees;
  const positionSyncTolerance = Math.max(0.04, options.runtimeConfig.collider.standing.radius * 0.4);

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

      const rayNormal = hit.getNormal(true) ?? Vector3.UpReadOnly.clone();
      const rayNormalY = Math.max(-1, Math.min(1, rayNormal.y));
      const raySlopeAngleDegrees = toDegrees(Math.acos(rayNormalY));
      const controllerRootPosition = options.getControllerRootPosition?.() ?? null;
      const isControllerSynced =
        controllerRootPosition !== null &&
        Math.abs(controllerRootPosition.x - input.position.x) <= positionSyncTolerance &&
        Math.abs(controllerRootPosition.y - input.position.y) <= positionSyncTolerance &&
        Math.abs(controllerRootPosition.z - input.position.z) <= positionSyncTolerance;
      const controllerGroundInfo = isControllerSynced
        ? (options.getControllerGroundInfo?.() ?? null)
        : null;
      const normal =
        controllerGroundInfo?.groundNormal && controllerGroundInfo.groundNormal.lengthSquared() > 0.0001
          ? controllerGroundInfo.groundNormal
          : rayNormal;
      const slopeAngleDegrees =
        controllerGroundInfo?.slopeAngleDegrees ?? raySlopeAngleDegrees;
      const isSlopeWalkable = slopeAngleDegrees <= slopeLimitDegrees;
      const distanceToGround = input.position.y - hit.pickedPoint.y;
      const threshold = input.wasGrounded
        ? options.runtimeConfig.locomotion.groundedStickDistance
        : options.runtimeConfig.locomotion.groundedSnapDistance;
      const rayGrounded =
        isSlopeWalkable &&
        distanceToGround >= -UPWARD_GROUND_TOLERANCE &&
        distanceToGround <= threshold;
      const isGrounded =
        controllerGroundInfo !== null
          ? controllerGroundInfo.isGrounded && rayGrounded
          : rayGrounded;

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
