// Responsável por exibir marcadores e logs de diagnóstico para o snap/alinhamento do sistema de ledge.
import {
  Color3,
  LinesMesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene
} from "@babylonjs/core";
import type { LedgeGrabCandidate } from "./ledge-detection-system";

export type LedgeDebugSnapshot = {
  candidate: LedgeGrabCandidate | null;
  characterRootPosition: Vector3 | null;
  colliderCenterPosition: Vector3 | null;
};

export type LedgeDebugHandle = {
  render: (snapshot: LedgeDebugSnapshot | null) => void;
  log: (label: string, snapshot: LedgeDebugSnapshot | null) => void;
  dispose: () => void;
};

type DebugMarkerKey =
  | "wallHit"
  | "topHit"
  | "edge"
  | "hang"
  | "stand"
  | "root"
  | "collider";

function resolveInitialEnabledState(): boolean {
  const globalDebug = (globalThis as { __DAB_LEDGE_DEBUG__?: unknown }).__DAB_LEDGE_DEBUG__;
  if (typeof globalDebug === "boolean") {
    return globalDebug;
  }

  return import.meta.env.DEV;
}

function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toDebugPoint(point: Vector3 | null): { x: number; y: number; z: number } | null {
  if (!point) {
    return null;
  }

  return {
    x: roundValue(point.x),
    y: roundValue(point.y),
    z: roundValue(point.z)
  };
}

function createMarker(scene: Scene, name: string, color: Color3): Mesh {
  const material = new StandardMaterial(`LedgeDebugMaterial_${name}`, scene);
  material.emissiveColor = color;
  material.disableLighting = true;

  const marker = MeshBuilder.CreateSphere(
    `LedgeDebugMarker_${name}`,
    { diameter: 0.14, segments: 8 },
    scene
  );
  marker.material = material;
  marker.isPickable = false;
  marker.isVisible = false;
  return marker;
}

function setMarkerPosition(marker: Mesh, point: Vector3 | null, enabled: boolean): void {
  marker.isVisible = enabled && !!point;
  if (enabled && point) {
    marker.position.copyFrom(point);
  }
}

export function createLedgeDebug(scene: Scene): LedgeDebugHandle {
  const enabled = resolveInitialEnabledState();
  const markers: Record<DebugMarkerKey, Mesh> = {
    wallHit: createMarker(scene, "WallHit", Color3.FromHexString("#ef4444")),
    topHit: createMarker(scene, "TopHit", Color3.FromHexString("#f97316")),
    edge: createMarker(scene, "Edge", Color3.FromHexString("#facc15")),
    hang: createMarker(scene, "Hang", Color3.FromHexString("#22d3ee")),
    stand: createMarker(scene, "Stand", Color3.FromHexString("#22c55e")),
    root: createMarker(scene, "Root", Color3.FromHexString("#ffffff")),
    collider: createMarker(scene, "Collider", Color3.FromHexString("#a855f7"))
  };

  const normalLine = MeshBuilder.CreateLines(
    "LedgeDebugNormal",
    { points: [Vector3.Zero(), Vector3.Zero()], updatable: true },
    scene
  );
  normalLine.isPickable = false;
  normalLine.color = Color3.FromHexString("#ef4444");
  normalLine.isVisible = false;

  const hideAll = (): void => {
    Object.values(markers).forEach((marker) => {
      marker.isVisible = false;
    });
    normalLine.isVisible = false;
  };

  return {
    render: (snapshot) => {
      if (!enabled || !snapshot?.candidate) {
        hideAll();
        return;
      }

      const { candidate } = snapshot;
      setMarkerPosition(markers.wallHit, candidate.wallHitPoint, enabled);
      setMarkerPosition(markers.topHit, candidate.topHitPoint, enabled);
      setMarkerPosition(markers.edge, candidate.edgePoint, enabled);
      setMarkerPosition(markers.hang, candidate.hangPosition, enabled);
      setMarkerPosition(markers.stand, candidate.standPosition, enabled);
      setMarkerPosition(markers.root, snapshot.characterRootPosition, enabled);
      setMarkerPosition(markers.collider, snapshot.colliderCenterPosition, enabled);

      MeshBuilder.CreateLines(
        "LedgeDebugNormal",
        {
          points: [
            candidate.wallHitPoint,
            candidate.wallHitPoint.add(candidate.wallNormal.scale(0.85))
          ],
          updatable: true,
          instance: normalLine
        },
        scene
      );
      normalLine.isVisible = true;
    },
    log: (label, snapshot) => {
      if (!enabled || !snapshot?.candidate) {
        return;
      }

      const { candidate } = snapshot;
      console.debug(`[ledge][${label}]`, {
        wallMesh: candidate.wallMesh.name,
        topMesh: candidate.topMesh.name,
        rawWallHitPoint: toDebugPoint(candidate.wallHitPoint),
        rawTopPoint: toDebugPoint(candidate.topHitPoint),
        edgePoint: toDebugPoint(candidate.edgePoint),
        hangPoint: toDebugPoint(candidate.hangPosition),
        standPoint: toDebugPoint(candidate.standPosition),
        wallNormal: toDebugPoint(candidate.wallNormal),
        facingDirection: toDebugPoint(candidate.facingDirection),
        characterRootPosition: toDebugPoint(snapshot.characterRootPosition),
        colliderCenterPosition: toDebugPoint(snapshot.colliderCenterPosition),
        ledgeHeight: roundValue(candidate.ledgeHeight)
      });
    },
    dispose: () => {
      Object.values(markers).forEach((marker) => {
        marker.dispose(false, true);
      });
      normalLine.dispose(false, true);
    }
  };
}
