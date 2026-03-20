// Responsável por detectar ledge hang e mantle com múltiplos probes (parede/topo/clearance) e classificação por ângulo.
import { Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";
import type { ShapeQueryService } from "../physics/shape-query-service";
import type { GroundedSystem } from "./grounded-system";
import { clamp } from "../utils/math";

export type LedgeCandidateKind = "hang" | "mantle";

export type LedgeDetectionProbe = {
  label: string;
  origin: Vector3;
  direction: Vector3;
  length: number;
  hit: boolean;
  point: Vector3 | null;
  normal: Vector3 | null;
  slopeAngleDegrees: number | null;
  meshName: string | null;
};

export type LedgeGrabCandidate = {
  kind: LedgeCandidateKind;
  wallMesh: AbstractMesh;
  topMesh: AbstractMesh;
  wallHitPoint: Vector3;
  topHitPoint: Vector3;
  ledgePoint: Vector3;
  edgePoint: Vector3;
  wallNormal: Vector3;
  topNormal: Vector3;
  facingDirection: Vector3;
  hangPosition: Vector3;
  climbStartPosition: Vector3;
  standPosition: Vector3;
  climbEndPosition: Vector3;
  rotationY: number;
  ledgeHeight: number;
  slopeAngleDegrees: number;
  probes: LedgeDetectionProbe[];
};

export type LedgeDetectionAttempt = {
  kind: LedgeCandidateKind;
  reason: string;
  probes: LedgeDetectionProbe[];
  ledgeHeight: number | null;
  slopeAngleDegrees: number | null;
};

export type LedgeDetectionSystem = {
  detect: (input: {
    currentTransform: { x: number; y: number; z: number; rotationY: number };
    approachDirection: Vector3;
  }) => LedgeGrabCandidate | null;
  detectLedge: (input: {
    currentTransform: { x: number; y: number; z: number; rotationY: number };
    approachDirection: Vector3;
  }) => LedgeGrabCandidate | null;
  detectMantle: (input: {
    currentTransform: { x: number; y: number; z: number; rotationY: number };
    approachDirection: Vector3;
  }) => LedgeGrabCandidate | null;
  getLastAttempt: () => LedgeDetectionAttempt | null;
};

export type CreateLedgeDetectionSystemOptions = {
  scene: Scene;
  runtimeConfig: CharacterRuntimeConfig;
  groundedSystem: GroundedSystem;
  isEnvironmentMesh: (mesh: AbstractMesh) => boolean;
  isClimbableMesh: (mesh: AbstractMesh) => boolean;
  shapeQueryService?: ShapeQueryService;
};

type ProbeHit = {
  point: Vector3;
  mesh: AbstractMesh;
  distance: number;
  normal: Vector3 | null;
};

type ProbeCastResult = {
  hit: ProbeHit | null;
  normal: Vector3 | null;
};

type CandidateInput = {
  kind: LedgeCandidateKind;
  approachDirection: Vector3;
  currentTransform: { x: number; y: number; z: number; rotationY: number };
  probes: LedgeDetectionProbe[];
};

const MIN_APPROACH_DOT = 0.45;
const MAX_HANG_WALL_NORMAL_Y = 0.34;
const MAX_MANTLE_WALL_NORMAL_Y = 0.84;
const CLEARANCE_ORIGIN_Y = 0.05;
const CLEARANCE_SAMPLE_RADIUS_SCALE = 0.62;
const TOP_PROBE_INSET_SCALE = 0.42;
const TOP_PROBE_INSET_MIN = 0.18;
const HANG_HEAD_CLEARANCE_MARGIN = 0.08;
const SHAPE_QUERY_RADIUS_SCALE = 0.2;
const SHAPE_QUERY_RADIUS_MIN = 0.06;

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function slopeAngleFromNormal(normal: Vector3): number {
  return toDegrees(Math.acos(clamp(normal.y, -1, 1)));
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

export function computeHangTarget(input: {
  edgePoint: Vector3;
  wallNormal: Vector3;
  facingDirection: Vector3;
  runtimeConfig: CharacterRuntimeConfig;
}): Vector3 {
  const hangDistance = input.runtimeConfig.collider.standing.radius + input.runtimeConfig.ledge.hangForwardOffset;
  const hangRight = new Vector3(input.facingDirection.z, 0, -input.facingDirection.x).normalize();
  const hangPosition = input.edgePoint
    .add(input.wallNormal.scale(hangDistance))
    .add(hangRight.scale(input.runtimeConfig.ledge.hangLateralOffset));
  hangPosition.y = input.edgePoint.y - input.runtimeConfig.ledge.hangVerticalOffset;
  return hangPosition;
}

export function computeClimbEndPosition(input: {
  topPoint: Vector3;
  facingDirection: Vector3;
  runtimeConfig: CharacterRuntimeConfig;
  groundedSystem: GroundedSystem;
  forwardOffset?: number;
}): Vector3 | null {
  const standDepth =
    input.runtimeConfig.collider.standing.radius +
    input.runtimeConfig.ledge.topStandOffset +
    (input.forwardOffset ?? 0);
  const standProbePosition = input.topPoint.add(input.facingDirection.scale(standDepth));
  const standGround = input.groundedSystem.detect({
    position: {
      x: standProbePosition.x,
      y: input.topPoint.y + input.runtimeConfig.collider.collisionClearanceY + CLEARANCE_ORIGIN_Y,
      z: standProbePosition.z
    },
    wasGrounded: false
  });

  if (!standGround.isGrounded || !standGround.hitMesh) {
    return null;
  }

  return new Vector3(
    standProbePosition.x,
    standGround.groundY + input.runtimeConfig.collider.collisionClearanceY,
    standProbePosition.z
  );
}

function castProbe(options: {
  scene: Scene;
  runtimeConfig: CharacterRuntimeConfig;
  shapeQueryService?: ShapeQueryService;
  origin: Vector3;
  direction: Vector3;
  length: number;
  label: string;
  probes: LedgeDetectionProbe[];
  predicate: (mesh: AbstractMesh) => boolean;
  shapeRadius?: number;
}): ProbeCastResult {
  const direction = options.direction.lengthSquared() > 0.0001
    ? options.direction.normalizeToNew()
    : Vector3.Forward();

  const shapeRadius = options.shapeRadius
    ?? Math.max(
      SHAPE_QUERY_RADIUS_MIN,
      options.runtimeConfig.collider.standing.radius * SHAPE_QUERY_RADIUS_SCALE
    );

  let hitPoint: Vector3 | null = null;
  let hitMesh: AbstractMesh | null = null;
  let hitDistance: number | null = null;
  let normal: Vector3 | null = null;

  if (options.shapeQueryService) {
    const shapeHit = options.shapeQueryService.sphereCast({
      label: options.label,
      origin: options.origin,
      direction,
      length: options.length,
      radius: shapeRadius,
      predicate: options.predicate
    });

    if (shapeHit.hit && shapeHit.point && shapeHit.mesh) {
      hitPoint = shapeHit.point.clone();
      hitMesh = shapeHit.mesh;
      hitDistance = shapeHit.distance;
      normal = shapeHit.normal ? shapeHit.normal.clone() : null;
    }
  }

  if (!hitPoint || !hitMesh) {
    const ray = new Ray(options.origin.clone(), direction, options.length);
    const hitInfo = options.scene.pickWithRay(ray, options.predicate, false);
    if (hitInfo?.hit && hitInfo.pickedPoint && hitInfo.pickedMesh) {
      hitPoint = hitInfo.pickedPoint.clone();
      hitMesh = hitInfo.pickedMesh;
      hitDistance = typeof hitInfo.distance === "number" ? hitInfo.distance : options.length;
      normal = hitInfo.getNormal(true)?.normalize() ?? normal;
    }
  }

  options.probes.push({
    label: options.label,
    origin: options.origin.clone(),
    direction: direction.clone(),
    length: options.length,
    hit: !!hitPoint,
    point: hitPoint ? hitPoint.clone() : null,
    normal: normal ? normal.clone() : null,
    slopeAngleDegrees: normal ? slopeAngleFromNormal(normal) : null,
    meshName: hitMesh?.name ?? null
  });

  return {
    hit: hitPoint && hitMesh
      ? {
          point: hitPoint,
          mesh: hitMesh,
          distance: hitDistance ?? options.length,
          normal: normal ? normal.clone() : null
        }
      : null,
    normal
  };
}

function cloneProbes(probes: LedgeDetectionProbe[]): LedgeDetectionProbe[] {
  return probes.map((probe) => ({
    ...probe,
    origin: probe.origin.clone(),
    direction: probe.direction.clone(),
    point: probe.point ? probe.point.clone() : null,
    normal: probe.normal ? probe.normal.clone() : null
  }));
}

export function createLedgeDetectionSystem(
  options: CreateLedgeDetectionSystemOptions
): LedgeDetectionSystem {
  let lastAttempt: LedgeDetectionAttempt | null = null;

  const setAttempt = (
    kind: LedgeCandidateKind,
    reason: string,
    probes: LedgeDetectionProbe[],
    extra?: Partial<Pick<LedgeDetectionAttempt, "ledgeHeight" | "slopeAngleDegrees">>
  ): null => {
    lastAttempt = {
      kind,
      reason,
      probes: cloneProbes(probes),
      ledgeHeight: extra?.ledgeHeight ?? null,
      slopeAngleDegrees: extra?.slopeAngleDegrees ?? null
    };
    return null;
  };

  const canStandAt = (standPosition: Vector3, probes: LedgeDetectionProbe[]): boolean => {
    const clearanceSampleRadius = options.runtimeConfig.collider.standing.radius * CLEARANCE_SAMPLE_RADIUS_SCALE;
    const sampleOffsets = buildSampleOffsets(clearanceSampleRadius);

    return sampleOffsets.every((offset, index) => {
      const origin = new Vector3(
        standPosition.x + offset.x,
        standPosition.y + CLEARANCE_ORIGIN_Y,
        standPosition.z + offset.z
      );

      const clearanceProbe = castProbe({
        scene: options.scene,
        runtimeConfig: options.runtimeConfig,
        shapeQueryService: options.shapeQueryService,
        origin,
        direction: Vector3.UpReadOnly.clone(),
        length: options.runtimeConfig.ledge.topClearanceHeight,
        label: `clearance-${index}`,
        probes,
        predicate: (mesh) => options.isEnvironmentMesh(mesh)
      });

      return !clearanceProbe.hit;
    });
  };

  const buildCandidate = (input: CandidateInput): LedgeGrabCandidate | null => {
    const { currentTransform, approachDirection, probes } = input;
    const runtimeConfig = options.runtimeConfig;
    const ledgeConfig = runtimeConfig.ledge;
    const wallPredicate = input.kind === "hang"
      ? (mesh: AbstractMesh) => options.isClimbableMesh(mesh) || options.isEnvironmentMesh(mesh)
      : (mesh: AbstractMesh) => options.isEnvironmentMesh(mesh);
    const wallProbeDistance =
      input.kind === "hang"
        ? ledgeConfig.hangDetectionDistance
        : ledgeConfig.wallDetectionDistance;

    const chestProbe = castProbe({
      scene: options.scene,
      runtimeConfig,
      shapeQueryService: options.shapeQueryService,
      origin: new Vector3(
        currentTransform.x,
        currentTransform.y + ledgeConfig.chestProbeHeight,
        currentTransform.z
      ),
      direction: approachDirection,
      length: wallProbeDistance,
      label: `${input.kind}-chest`,
      probes,
      predicate: wallPredicate
    });

    const chestHit = chestProbe.hit;
    if (!chestHit) {
      return setAttempt(input.kind, "missing-front-wall-hit", probes);
    }

    const wallNormal = chestProbe.normal;
    if (!wallNormal) {
      return setAttempt(input.kind, "missing-wall-normal", probes);
    }

    const wallNormalYLimit = input.kind === "hang" ? MAX_HANG_WALL_NORMAL_Y : MAX_MANTLE_WALL_NORMAL_Y;
    if (Math.abs(wallNormal.y) > wallNormalYLimit) {
      return setAttempt(input.kind, "wall-too-inclined", probes);
    }

    const facingDirection = wallNormal.scale(-1).normalize();
    if (Vector3.Dot(approachDirection, facingDirection) < MIN_APPROACH_DOT) {
      return setAttempt(input.kind, "bad-approach-angle", probes);
    }

    const headProbe = castProbe({
      scene: options.scene,
      runtimeConfig,
      shapeQueryService: options.shapeQueryService,
      origin: new Vector3(
        currentTransform.x,
        currentTransform.y + ledgeConfig.headProbeHeight,
        currentTransform.z
      ),
      direction: approachDirection,
      length: wallProbeDistance,
      label: `${input.kind}-head`,
      probes,
      predicate: wallPredicate
    });

    if (
      input.kind === "hang" &&
      headProbe.hit &&
      headProbe.hit.distance <= chestHit.distance + HANG_HEAD_CLEARANCE_MARGIN
    ) {
      return setAttempt(input.kind, "head-blocked-for-hang", probes);
    }

    const topProbeInset = Math.max(
      TOP_PROBE_INSET_MIN,
      runtimeConfig.collider.standing.radius * TOP_PROBE_INSET_SCALE
    );
    const topProbeOrigin = chestHit.point
      .add(facingDirection.scale(topProbeInset));
    topProbeOrigin.y =
      currentTransform.y + ledgeConfig.maxClimbHeight + ledgeConfig.topProbeHeightPadding;

    const topProbe = castProbe({
      scene: options.scene,
      runtimeConfig,
      shapeQueryService: options.shapeQueryService,
      origin: topProbeOrigin,
      direction: Vector3.DownReadOnly.clone(),
      length:
        ledgeConfig.maxClimbHeight +
        ledgeConfig.topClearanceHeight +
        runtimeConfig.collider.standing.height,
      label: `${input.kind}-top-down`,
      probes,
      predicate: (mesh) => options.isEnvironmentMesh(mesh)
    });

    const topHit = topProbe.hit;
    if (!topHit) {
      return setAttempt(input.kind, "missing-top-surface", probes);
    }

    const topNormal = topProbe.normal;
    if (!topNormal) {
      return setAttempt(input.kind, "missing-top-normal", probes);
    }

    const slopeAngleDegrees = slopeAngleFromNormal(topNormal);
    if (slopeAngleDegrees > ledgeConfig.maxMantleSlopeAngleDegrees) {
      return setAttempt(input.kind, "top-slope-too-steep", probes, {
        slopeAngleDegrees
      });
    }

    const edgePoint = projectPointOntoPlane(
      topHit.point.clone(),
      chestHit.point.clone(),
      wallNormal
    );
    edgePoint.y = topHit.point.y;

    const ledgeHeight = edgePoint.y - currentTransform.y;
    if (
      ledgeHeight < ledgeConfig.minClimbHeight ||
      ledgeHeight > ledgeConfig.maxClimbHeight
    ) {
      return setAttempt(input.kind, "invalid-climb-height", probes, {
        ledgeHeight,
        slopeAngleDegrees
      });
    }

    const climbEndPosition = computeClimbEndPosition({
      topPoint: topHit.point.clone(),
      facingDirection,
      runtimeConfig,
      groundedSystem: options.groundedSystem,
      forwardOffset: input.kind === "mantle" ? ledgeConfig.mantleForwardOffset : 0
    });
    if (!climbEndPosition) {
      return setAttempt(input.kind, "no-valid-stand-position", probes, {
        ledgeHeight,
        slopeAngleDegrees
      });
    }

    if (!canStandAt(climbEndPosition, probes)) {
      return setAttempt(input.kind, "blocked-clearance-at-destination", probes, {
        ledgeHeight,
        slopeAngleDegrees
      });
    }

    const hangPosition = computeHangTarget({
      edgePoint,
      wallNormal,
      facingDirection,
      runtimeConfig
    });

    const climbStartPosition = input.kind === "hang"
      ? hangPosition.clone()
      : new Vector3(currentTransform.x, currentTransform.y, currentTransform.z);

    const candidate: LedgeGrabCandidate = {
      kind: input.kind,
      wallMesh: chestHit.mesh,
      topMesh: topHit.mesh,
      wallHitPoint: chestHit.point.clone(),
      topHitPoint: topHit.point.clone(),
      ledgePoint: edgePoint.clone(),
      edgePoint,
      wallNormal: wallNormal.clone(),
      topNormal: topNormal.clone(),
      facingDirection,
      hangPosition,
      climbStartPosition,
      standPosition: climbEndPosition.clone(),
      climbEndPosition,
      rotationY: Math.atan2(facingDirection.x, facingDirection.z) + ledgeConfig.hangRotationOffsetRadians,
      ledgeHeight,
      slopeAngleDegrees,
      probes: cloneProbes(probes)
    };

    setAttempt(input.kind, "accepted", probes, {
      ledgeHeight,
      slopeAngleDegrees
    });
    return candidate;
  };

  const detectLedge = (input: {
    currentTransform: { x: number; y: number; z: number; rotationY: number };
    approachDirection: Vector3;
  }): LedgeGrabCandidate | null => {
    const probes: LedgeDetectionProbe[] = [];
    if (input.approachDirection.lengthSquared() <= 0.0001) {
      return setAttempt("hang", "missing-approach-direction", probes);
    }

    return buildCandidate({
      kind: "hang",
      approachDirection: input.approachDirection.normalizeToNew(),
      currentTransform: input.currentTransform,
      probes
    });
  };

  const detectMantle = (input: {
    currentTransform: { x: number; y: number; z: number; rotationY: number };
    approachDirection: Vector3;
  }): LedgeGrabCandidate | null => {
    const probes: LedgeDetectionProbe[] = [];
    if (input.approachDirection.lengthSquared() <= 0.0001) {
      return setAttempt("mantle", "missing-approach-direction", probes);
    }

    return buildCandidate({
      kind: "mantle",
      approachDirection: input.approachDirection.normalizeToNew(),
      currentTransform: input.currentTransform,
      probes
    });
  };

  return {
    detect: (input) => {
      const ledgeCandidate = detectLedge(input);
      if (ledgeCandidate) {
        return ledgeCandidate;
      }
      return detectMantle(input);
    },
    detectLedge,
    detectMantle,
    getLastAttempt: () => {
      if (!lastAttempt) {
        return null;
      }

      return {
        ...lastAttempt,
        probes: cloneProbes(lastAttempt.probes)
      };
    }
  };
}
