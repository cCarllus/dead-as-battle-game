// Responsável por validar parede frontal, topo útil e espaço livre para disparar ledge hang com segurança.
import { Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";
import type { GroundedSystem } from "./grounded-system";

export type LedgeGrabCandidate = {
  wallMesh: AbstractMesh;
  topMesh: AbstractMesh;
  wallHitPoint: Vector3;
  topHitPoint: Vector3;
  ledgePoint: Vector3;
  edgePoint: Vector3;
  wallNormal: Vector3;
  facingDirection: Vector3;
  hangPosition: Vector3;
  standPosition: Vector3;
  rotationY: number;
  ledgeHeight: number;
};

export type LedgeDetectionSystem = {
  detect: (input: {
    currentTransform: { x: number; y: number; z: number; rotationY: number };
    approachDirection: Vector3;
  }) => LedgeGrabCandidate | null;
};

export type CreateLedgeDetectionSystemOptions = {
  scene: Scene;
  runtimeConfig: CharacterRuntimeConfig;
  groundedSystem: GroundedSystem;
  isEnvironmentMesh: (mesh: AbstractMesh) => boolean;
  isClimbableMesh: (mesh: AbstractMesh) => boolean;
};

const MIN_APPROACH_DOT = 0.48;
const MAX_WALL_NORMAL_Y = 0.24;
const MIN_TOP_NORMAL_Y = 0.84;
const TOP_PROBE_INSET_SCALE = 0.4;
const TOP_PROBE_INSET_MIN = 0.18;
const CLEARANCE_ORIGIN_Y = 0.05;
const CLEARANCE_SAMPLE_RADIUS_SCALE = 0.62;

function createRay(length: number, direction: Vector3): Ray {
  return new Ray(Vector3.Zero(), direction, length);
}

function projectPointOntoPlane(point: Vector3, planePoint: Vector3, planeNormal: Vector3): Vector3 {
  const distanceToPlane = Vector3.Dot(point.subtract(planePoint), planeNormal);
  return point.subtract(planeNormal.scale(distanceToPlane));
}

function buildSampleOffsets(radius: number): Vector3[] {
  return [
    Vector3.Zero(),
    new Vector3(radius, 0, 0),
    new Vector3(-radius, 0, 0),
    new Vector3(0, 0, radius),
    new Vector3(0, 0, -radius)
  ];
}

export function createLedgeDetectionSystem(
  options: CreateLedgeDetectionSystemOptions
): LedgeDetectionSystem {
  const forwardRay = createRay(options.runtimeConfig.ledge.ledgeDetectionDistance, Vector3.Forward());
  const downRay = createRay(
    options.runtimeConfig.ledge.maximumLedgeHeight +
      options.runtimeConfig.ledge.topClearanceHeight +
      options.runtimeConfig.colliderHeight,
    Vector3.DownReadOnly.clone()
  );
  const upRay = createRay(options.runtimeConfig.ledge.topClearanceHeight, Vector3.UpReadOnly.clone());

  const canStandAt = (standPosition: Vector3): boolean => {
    const clearanceSampleRadius = options.runtimeConfig.colliderRadius * CLEARANCE_SAMPLE_RADIUS_SCALE;
    const sampleOffsets = buildSampleOffsets(clearanceSampleRadius);

    return sampleOffsets.every((offset) => {
      upRay.origin.set(
        standPosition.x + offset.x,
        standPosition.y + CLEARANCE_ORIGIN_Y,
        standPosition.z + offset.z
      );
      upRay.length = options.runtimeConfig.ledge.topClearanceHeight;

      const hit = options.scene.pickWithRay(
        upRay,
        (mesh) => options.isEnvironmentMesh(mesh),
        false
      );

      return !hit?.hit || !Number.isFinite(hit.distance) || hit.distance > upRay.length;
    });
  };

  return {
    detect: (input) => {
      if (input.approachDirection.lengthSquared() <= 0.0001) {
        return null;
      }

      const approachDirection = input.approachDirection.normalizeToNew();
      forwardRay.origin.set(
        input.currentTransform.x,
        input.currentTransform.y + options.runtimeConfig.wallCheckOffsetY,
        input.currentTransform.z
      );
      forwardRay.direction.copyFrom(approachDirection);
      forwardRay.length = options.runtimeConfig.ledge.ledgeDetectionDistance;

      const wallHit = options.scene.pickWithRay(
        forwardRay,
        (mesh) => options.isClimbableMesh(mesh),
        false
      );

      if (!wallHit?.hit || !wallHit.pickedPoint || !wallHit.pickedMesh) {
        return null;
      }

      const wallNormal = wallHit.getNormal(true)?.normalize();
      if (!wallNormal || Math.abs(wallNormal.y) > MAX_WALL_NORMAL_Y) {
        return null;
      }

      const facingDirection = wallNormal.scale(-1);
      if (Vector3.Dot(approachDirection, facingDirection) < MIN_APPROACH_DOT) {
        return null;
      }

      const topProbeInset = Math.max(
        TOP_PROBE_INSET_MIN,
        options.runtimeConfig.colliderRadius * TOP_PROBE_INSET_SCALE
      );
      downRay.origin.copyFrom(wallHit.pickedPoint);
      downRay.origin.addInPlace(facingDirection.scale(topProbeInset));
      downRay.origin.y =
        input.currentTransform.y +
        options.runtimeConfig.ledge.maximumLedgeHeight +
        options.runtimeConfig.ledge.topClearanceHeight;
      downRay.length =
        options.runtimeConfig.ledge.maximumLedgeHeight +
        options.runtimeConfig.ledge.topClearanceHeight +
        options.runtimeConfig.colliderHeight;

      const topHit = options.scene.pickWithRay(
        downRay,
        (mesh) => options.isEnvironmentMesh(mesh),
        false
      );

      if (!topHit?.hit || !topHit.pickedPoint || !topHit.pickedMesh) {
        return null;
      }

      if (
        topHit.pickedMesh.uniqueId !== wallHit.pickedMesh.uniqueId &&
        !options.isClimbableMesh(topHit.pickedMesh)
      ) {
        return null;
      }

      const topNormal = topHit.getNormal(true)?.normalize();
      if (!topNormal || topNormal.y < MIN_TOP_NORMAL_Y) {
        return null;
      }

      const edgePoint = projectPointOntoPlane(
        topHit.pickedPoint.clone(),
        wallHit.pickedPoint.clone(),
        wallNormal
      );
      edgePoint.y = topHit.pickedPoint.y;

      const ledgeHeight = edgePoint.y - input.currentTransform.y;
      if (
        ledgeHeight < options.runtimeConfig.ledge.minimumLedgeHeight ||
        ledgeHeight > options.runtimeConfig.ledge.maximumLedgeHeight
      ) {
        return null;
      }

      const standDepth = options.runtimeConfig.colliderRadius + options.runtimeConfig.ledge.topStandOffset;
      const standProbePosition = topHit.pickedPoint.add(facingDirection.scale(standDepth));
      const standGround = options.groundedSystem.detect({
        position: {
          x: standProbePosition.x,
          y: topHit.pickedPoint.y + options.runtimeConfig.collisionClearanceY + CLEARANCE_ORIGIN_Y,
          z: standProbePosition.z
        },
        wasGrounded: false
      });

      if (!standGround.isGrounded || !standGround.hitMesh || !options.isEnvironmentMesh(standGround.hitMesh)) {
        return null;
      }

      const standPosition = new Vector3(
        standProbePosition.x,
        standGround.groundY + options.runtimeConfig.collisionClearanceY,
        standProbePosition.z
      );

      if (!canStandAt(standPosition)) {
        return null;
      }

      const hangDistance = options.runtimeConfig.colliderRadius + options.runtimeConfig.ledge.hangForwardOffset;
      const hangRight = new Vector3(facingDirection.z, 0, -facingDirection.x).normalize();
      const hangPosition = edgePoint
        .add(wallNormal.scale(hangDistance))
        .add(hangRight.scale(options.runtimeConfig.ledge.hangLateralOffset));
      hangPosition.y = edgePoint.y - options.runtimeConfig.ledge.hangVerticalOffset;

      return {
        wallMesh: wallHit.pickedMesh,
        topMesh: topHit.pickedMesh,
        wallHitPoint: wallHit.pickedPoint.clone(),
        topHitPoint: topHit.pickedPoint.clone(),
        ledgePoint: edgePoint.clone(),
        edgePoint,
        wallNormal: wallNormal.clone(),
        facingDirection,
        hangPosition,
        standPosition,
        rotationY:
          Math.atan2(facingDirection.x, facingDirection.z) +
          options.runtimeConfig.ledge.hangRotationOffsetRadians,
        ledgeHeight
      };
    }
  };
}
