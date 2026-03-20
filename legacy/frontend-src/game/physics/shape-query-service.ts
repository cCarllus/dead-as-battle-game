// Responsável por concentrar shape casts/raycasts de traversal com fallback seguro quando Havok query não estiver disponível.
import { Quaternion, Ray, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import { ShapeCastResult } from "@babylonjs/core/Physics/shapeCastResult";
import { PhysicsShapeSphere } from "@babylonjs/core/Physics/v2/physicsShape";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";

const IDENTITY_ROTATION = Quaternion.Identity();
const MAX_DEBUG_ENTRIES = 40;
const SHAPE_RADIUS_EPSILON = 0.001;

type HavokShapeCastPlugin = {
  shapeCast: (
    query: {
      shape: PhysicsShapeSphere;
      rotation: Quaternion;
      startPosition: Vector3;
      endPosition: Vector3;
      shouldHitTriggers: boolean;
      ignoreBody?: PhysicsBody;
    },
    inputShapeResult: ShapeCastResult,
    hitShapeResult: ShapeCastResult
  ) => void;
};

export type ShapeQueryHit = {
  hit: boolean;
  point: Vector3 | null;
  normal: Vector3 | null;
  distance: number | null;
  fraction: number | null;
  mesh: AbstractMesh | null;
  body: PhysicsBody | null;
  method: "shape-cast" | "raycast";
};

export type ShapeQueryDebugEntry = {
  label: string;
  method: "shape-cast" | "raycast";
  origin: Vector3;
  direction: Vector3;
  length: number;
  radius: number;
  hit: boolean;
  point: Vector3 | null;
  normal: Vector3 | null;
  meshName: string | null;
  distance: number | null;
};

export type ShapeQueryDebugSnapshot = {
  hasShapeCastSupport: boolean;
  entries: ShapeQueryDebugEntry[];
};

export type SphereCastQuery = {
  label: string;
  origin: Vector3;
  direction: Vector3;
  length: number;
  radius: number;
  predicate: (mesh: AbstractMesh) => boolean;
  ignoreBody?: PhysicsBody;
};

export type ShapeQueryService = {
  sphereCast: (query: SphereCastQuery) => ShapeQueryHit;
  detectWallForHang: (query: SphereCastQuery) => ShapeQueryHit;
  detectMantleCandidate: (query: SphereCastQuery) => ShapeQueryHit;
  detectClimbTop: (query: SphereCastQuery) => ShapeQueryHit;
  validateFreeSpaceAtTarget: (query: SphereCastQuery) => ShapeQueryHit;
  getDebugSnapshot: () => ShapeQueryDebugSnapshot;
  dispose: () => void;
};

export type CreateShapeQueryServiceOptions = {
  scene: Scene;
  resolveMeshFromBody: (body: PhysicsBody | null | undefined) => AbstractMesh | null;
};

function cloneDebugEntry(entry: ShapeQueryDebugEntry): ShapeQueryDebugEntry {
  return {
    label: entry.label,
    method: entry.method,
    origin: entry.origin.clone(),
    direction: entry.direction.clone(),
    length: entry.length,
    radius: entry.radius,
    hit: entry.hit,
    point: entry.point ? entry.point.clone() : null,
    normal: entry.normal ? entry.normal.clone() : null,
    meshName: entry.meshName,
    distance: entry.distance
  };
}

function toFinitePositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function createShapeQueryService(options: CreateShapeQueryServiceOptions): ShapeQueryService {
  const sphereShapeCache = new Map<string, PhysicsShapeSphere>();
  const debugEntries: ShapeQueryDebugEntry[] = [];
  const inputShapeResult = new ShapeCastResult();
  const hitShapeResult = new ShapeCastResult();

  const resolveShapeCastPlugin = (): HavokShapeCastPlugin | null => {
    const plugin = options.scene.getPhysicsEngine()?.getPhysicsPlugin() as unknown;
    if (!plugin || typeof plugin !== "object") {
      return null;
    }

    const candidate = plugin as Partial<HavokShapeCastPlugin>;
    if (typeof candidate.shapeCast !== "function") {
      return null;
    }

    return candidate as HavokShapeCastPlugin;
  };

  const getSphereShape = (radius: number): PhysicsShapeSphere => {
    const safeRadius = Math.max(SHAPE_RADIUS_EPSILON, radius);
    const shapeKey = safeRadius.toFixed(4);
    const cachedShape = sphereShapeCache.get(shapeKey);
    if (cachedShape) {
      return cachedShape;
    }

    const nextShape = new PhysicsShapeSphere(Vector3.Zero(), safeRadius, options.scene);
    sphereShapeCache.set(shapeKey, nextShape);
    return nextShape;
  };

  const pushDebugEntry = (entry: ShapeQueryDebugEntry): void => {
    debugEntries.push(entry);
    if (debugEntries.length > MAX_DEBUG_ENTRIES) {
      debugEntries.splice(0, debugEntries.length - MAX_DEBUG_ENTRIES);
    }
  };

  const buildRaycastHit = (query: SphereCastQuery): ShapeQueryHit => {
    const safeDirection = query.direction.lengthSquared() > 0.0001
      ? query.direction.normalizeToNew()
      : new Vector3(0, 0, 1);
    const ray = new Ray(query.origin.clone(), safeDirection, query.length);
    const pick = options.scene.pickWithRay(ray, query.predicate, false);
    const hitMesh = pick?.hit && pick.pickedMesh ? pick.pickedMesh : null;
    const hitPoint = pick?.hit && pick.pickedPoint ? pick.pickedPoint.clone() : null;
    const hitNormal = pick?.hit ? pick.getNormal(true)?.normalize() ?? null : null;
    const distance = pick?.hit && typeof pick.distance === "number" ? pick.distance : null;

    pushDebugEntry({
      label: query.label,
      method: "raycast",
      origin: query.origin.clone(),
      direction: safeDirection.clone(),
      length: query.length,
      radius: query.radius,
      hit: !!pick?.hit,
      point: hitPoint ? hitPoint.clone() : null,
      normal: hitNormal ? hitNormal.clone() : null,
      meshName: hitMesh?.name ?? null,
      distance
    });

    return {
      hit: !!pick?.hit,
      point: hitPoint,
      normal: hitNormal ? hitNormal.clone() : null,
      distance,
      fraction: distance !== null && query.length > 0 ? distance / query.length : null,
      mesh: hitMesh,
      body: null,
      method: "raycast"
    };
  };

  const sphereCast = (query: SphereCastQuery): ShapeQueryHit => {
    const safeLength = toFinitePositive(query.length, 0.001);
    const safeRadius = Math.max(SHAPE_RADIUS_EPSILON, toFinitePositive(query.radius, 0.08));
    const safeDirection = query.direction.lengthSquared() > 0.0001
      ? query.direction.normalizeToNew()
      : new Vector3(0, 0, 1);

    const plugin = resolveShapeCastPlugin();
    if (!plugin) {
      return buildRaycastHit({
        ...query,
        direction: safeDirection,
        length: safeLength,
        radius: safeRadius
      });
    }

    const startPosition = query.origin.clone();
    const endPosition = startPosition.add(safeDirection.scale(safeLength));

    plugin.shapeCast(
      {
        shape: getSphereShape(safeRadius),
        rotation: IDENTITY_ROTATION,
        startPosition,
        endPosition,
        shouldHitTriggers: false,
        ignoreBody: query.ignoreBody
      },
      inputShapeResult,
      hitShapeResult
    );

    if (hitShapeResult.hasHit) {
      const body = (hitShapeResult.body as PhysicsBody | undefined) ?? null;
      const mesh = options.resolveMeshFromBody(body);
      const predicateAccepted = mesh ? query.predicate(mesh) : false;
      const point = hitShapeResult.hitPoint.clone();
      const normal = hitShapeResult.hitNormal.clone();
      const fraction = hitShapeResult.hitFraction;
      const distance = safeLength * fraction;

      if (mesh && predicateAccepted) {
        pushDebugEntry({
          label: query.label,
          method: "shape-cast",
          origin: query.origin.clone(),
          direction: safeDirection.clone(),
          length: safeLength,
          radius: safeRadius,
          hit: true,
          point: point.clone(),
          normal: normal.clone(),
          meshName: mesh.name,
          distance
        });

        return {
          hit: true,
          point,
          normal,
          distance,
          fraction,
          mesh,
          body,
          method: "shape-cast"
        };
      }
    }

    return buildRaycastHit({
      ...query,
      direction: safeDirection,
      length: safeLength,
      radius: safeRadius
    });
  };

  return {
    sphereCast,
    detectWallForHang: sphereCast,
    detectMantleCandidate: sphereCast,
    detectClimbTop: sphereCast,
    validateFreeSpaceAtTarget: sphereCast,
    getDebugSnapshot: () => {
      return {
        hasShapeCastSupport: resolveShapeCastPlugin() !== null,
        entries: debugEntries.map(cloneDebugEntry)
      };
    },
    dispose: () => {
      sphereShapeCache.forEach((shape) => {
        shape.dispose();
      });
      sphereShapeCache.clear();
      debugEntries.splice(0, debugEntries.length);
    }
  };
}
