// Responsável por consolidar logs de debug físico/traversal com foco em grounded, perfil de collider e drift visual.
import { Vector3 } from "@babylonjs/core";
import type { ShapeQueryDebugSnapshot } from "../physics/shape-query-service";

const DEBUG_THROTTLE_MS = 180;

export type PhysicsDebugSnapshot = {
  state: string;
  grounded: boolean;
  slopeAngle: number | null;
  horizontalSpeed: number;
  verticalVelocity: number;
  colliderProfile: string;
  rootPosition: Vector3;
  visualOffset: Vector3;
  velocity: Vector3;
  groundInfo: {
    supportedState: number;
    slopeAngleDegrees: number;
    isSurfaceDynamic: boolean;
  } | null;
  shapeQueries: ShapeQueryDebugSnapshot;
};

export type PhysicsDebugHandle = {
  render: (snapshot: PhysicsDebugSnapshot) => void;
  dispose: () => void;
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createPhysicsDebugLogger(label = "[physics][debug]"): PhysicsDebugHandle {
  let lastLogAtMs = 0;

  return {
    render: (snapshot) => {
      const explicitDebugEnabled = (globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown })
        .__DAB_ADVANCED_MOVEMENT_DEBUG__;
      if (explicitDebugEnabled !== true) {
        return;
      }

      const now = Date.now();
      if (now - lastLogAtMs < DEBUG_THROTTLE_MS) {
        return;
      }
      lastLogAtMs = now;

      const visualHeightError = Math.abs(snapshot.visualOffset.y);
      const visualHorizontalError = Math.hypot(snapshot.visualOffset.x, snapshot.visualOffset.z);
      const recentShapeQuery =
        snapshot.shapeQueries.entries.length > 0
          ? snapshot.shapeQueries.entries[snapshot.shapeQueries.entries.length - 1]
          : null;

      console.debug(label, {
        state: snapshot.state,
        grounded: snapshot.grounded,
        slopeAngle: snapshot.slopeAngle !== null ? round(snapshot.slopeAngle) : null,
        horizontalSpeed: round(snapshot.horizontalSpeed),
        verticalVelocity: round(snapshot.verticalVelocity),
        colliderProfile: snapshot.colliderProfile,
        rootPosition: {
          x: round(snapshot.rootPosition.x),
          y: round(snapshot.rootPosition.y),
          z: round(snapshot.rootPosition.z)
        },
        velocity: {
          x: round(snapshot.velocity.x),
          y: round(snapshot.velocity.y),
          z: round(snapshot.velocity.z)
        },
        rootToMeshOffset: {
          x: round(snapshot.visualOffset.x),
          y: round(snapshot.visualOffset.y),
          z: round(snapshot.visualOffset.z)
        },
        visualHeightError: round(visualHeightError),
        driftVerticalResidual: round(visualHeightError),
        driftHorizontalResidual: round(visualHorizontalError),
        groundInfo: snapshot.groundInfo
          ? {
              supportedState: snapshot.groundInfo.supportedState,
              slopeAngleDegrees: round(snapshot.groundInfo.slopeAngleDegrees),
              isSurfaceDynamic: snapshot.groundInfo.isSurfaceDynamic
            }
          : null,
        shapeCastSupport: snapshot.shapeQueries.hasShapeCastSupport,
        lastShapeQuery: recentShapeQuery
          ? {
              label: recentShapeQuery.label,
              method: recentShapeQuery.method,
              hit: recentShapeQuery.hit,
              meshName: recentShapeQuery.meshName,
              distance: recentShapeQuery.distance !== null ? round(recentShapeQuery.distance) : null
            }
          : null
      });
    },
    dispose: () => {
      lastLogAtMs = 0;
    }
  };
}
