// Responsável por exibir probes, normais e targets de hanging/mantle para inspeção em tempo real.
import {
  Color3,
  LinesMesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene
} from "@babylonjs/core";
import type { CharacterLocomotionState } from "./locomotion-state";
import type { LedgeCandidateKind, LedgeDetectionProbe, LedgeGrabCandidate } from "./ledge-detection-system";

export type LedgeDebugSnapshot = {
  candidate: LedgeGrabCandidate | null;
  probes?: LedgeDetectionProbe[];
  attemptReason?: string | null;
  attemptKind?: LedgeCandidateKind | null;
  characterRootPosition: Vector3 | null;
  colliderCenterPosition: Vector3 | null;
  state: CharacterLocomotionState;
  velocity: Vector3;
  verticalVelocity: number;
  isGrounded: boolean;
  slopeAngleDegrees: number | null;
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
  | "climbEnd"
  | "root"
  | "collider";

function resolveInitialEnabledState(): boolean {
  const globalDebug = (globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown }).__DAB_ADVANCED_MOVEMENT_DEBUG__;
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

function createProbeLine(scene: Scene, key: string, from: Vector3, to: Vector3, hit: boolean): LinesMesh {
  const line = MeshBuilder.CreateLines(
    `LedgeProbe_${key}`,
    { points: [from, to], updatable: false },
    scene
  );
  line.isPickable = false;
  line.color = hit ? Color3.FromHexString("#22c55e") : Color3.FromHexString("#ef4444");
  return line;
}

export function createLedgeDebug(scene: Scene): LedgeDebugHandle {
  const enabled = resolveInitialEnabledState();
  const markers: Record<DebugMarkerKey, Mesh> = {
    wallHit: createMarker(scene, "WallHit", Color3.FromHexString("#ef4444")),
    topHit: createMarker(scene, "TopHit", Color3.FromHexString("#f97316")),
    edge: createMarker(scene, "Edge", Color3.FromHexString("#facc15")),
    hang: createMarker(scene, "Hang", Color3.FromHexString("#22d3ee")),
    stand: createMarker(scene, "Stand", Color3.FromHexString("#22c55e")),
    climbEnd: createMarker(scene, "ClimbEnd", Color3.FromHexString("#38bdf8")),
    root: createMarker(scene, "Root", Color3.FromHexString("#ffffff")),
    collider: createMarker(scene, "Collider", Color3.FromHexString("#a855f7"))
  };

  const wallNormalLine = MeshBuilder.CreateLines(
    "LedgeDebugWallNormal",
    { points: [Vector3.Zero(), Vector3.Zero()], updatable: true },
    scene
  );
  wallNormalLine.isPickable = false;
  wallNormalLine.color = Color3.FromHexString("#ef4444");
  wallNormalLine.isVisible = false;

  const topNormalLine = MeshBuilder.CreateLines(
    "LedgeDebugTopNormal",
    { points: [Vector3.Zero(), Vector3.Zero()], updatable: true },
    scene
  );
  topNormalLine.isPickable = false;
  topNormalLine.color = Color3.FromHexString("#22d3ee");
  topNormalLine.isVisible = false;

  let probeLines: LinesMesh[] = [];

  const disposeProbeLines = (): void => {
    probeLines.forEach((line) => {
      line.dispose(false, true);
    });
    probeLines = [];
  };

  const hideAll = (): void => {
    Object.values(markers).forEach((marker) => {
      marker.isVisible = false;
    });
    wallNormalLine.isVisible = false;
    topNormalLine.isVisible = false;
    disposeProbeLines();
  };

  return {
    render: (snapshot) => {
      if (!enabled || !snapshot) {
        hideAll();
        return;
      }

      if (!snapshot.candidate) {
        setMarkerPosition(markers.root, snapshot.characterRootPosition, enabled);
        setMarkerPosition(markers.collider, snapshot.colliderCenterPosition, enabled);
        setMarkerPosition(markers.wallHit, null, enabled);
        setMarkerPosition(markers.topHit, null, enabled);
        setMarkerPosition(markers.edge, null, enabled);
        setMarkerPosition(markers.hang, null, enabled);
        setMarkerPosition(markers.stand, null, enabled);
        setMarkerPosition(markers.climbEnd, null, enabled);
        wallNormalLine.isVisible = false;
        topNormalLine.isVisible = false;

        disposeProbeLines();
        (snapshot.probes ?? []).forEach((probe, index) => {
          const toPoint = probe.point ?? probe.origin.add(probe.direction.scale(probe.length));
          const line = createProbeLine(scene, `${probe.label}_${index}`, probe.origin, toPoint, probe.hit);
          probeLines.push(line);
        });
        return;
      }

      const { candidate } = snapshot;
      setMarkerPosition(markers.wallHit, candidate.wallHitPoint, enabled);
      setMarkerPosition(markers.topHit, candidate.topHitPoint, enabled);
      setMarkerPosition(markers.edge, candidate.edgePoint, enabled);
      setMarkerPosition(markers.hang, candidate.hangPosition, enabled);
      setMarkerPosition(markers.stand, candidate.standPosition, enabled);
      setMarkerPosition(markers.climbEnd, candidate.climbEndPosition, enabled);
      setMarkerPosition(markers.root, snapshot.characterRootPosition, enabled);
      setMarkerPosition(markers.collider, snapshot.colliderCenterPosition, enabled);

      MeshBuilder.CreateLines(
        "LedgeDebugWallNormal",
        {
          points: [
            candidate.wallHitPoint,
            candidate.wallHitPoint.add(candidate.wallNormal.scale(0.85))
          ],
          updatable: true,
          instance: wallNormalLine
        },
        scene
      );
      wallNormalLine.isVisible = true;

      MeshBuilder.CreateLines(
        "LedgeDebugTopNormal",
        {
          points: [
            candidate.topHitPoint,
            candidate.topHitPoint.add(candidate.topNormal.scale(0.85))
          ],
          updatable: true,
          instance: topNormalLine
        },
        scene
      );
      topNormalLine.isVisible = true;

      disposeProbeLines();
      candidate.probes.forEach((probe, index) => {
        const toPoint = probe.point ?? probe.origin.add(probe.direction.scale(probe.length));
        const line = createProbeLine(scene, `${probe.label}_${index}`, probe.origin, toPoint, probe.hit);
        probeLines.push(line);
      });
    },
    log: (label, snapshot) => {
      if (!enabled || !snapshot) {
        return;
      }

      if (!snapshot.candidate) {
        console.debug(`[advanced-movement][${label}]`, {
          state: snapshot.state,
          isGrounded: snapshot.isGrounded,
          attemptKind: snapshot.attemptKind ?? null,
          attemptReason: snapshot.attemptReason ?? null,
          slopeAngle: snapshot.slopeAngleDegrees !== null ? roundValue(snapshot.slopeAngleDegrees) : null,
          velocity: toDebugPoint(snapshot.velocity),
          verticalVelocity: roundValue(snapshot.verticalVelocity),
          probes: (snapshot.probes ?? []).map((probe) => ({
            label: probe.label,
            hit: probe.hit,
            point: toDebugPoint(probe.point),
            normal: toDebugPoint(probe.normal),
            slopeAngle: probe.slopeAngleDegrees !== null ? roundValue(probe.slopeAngleDegrees) : null,
            meshName: probe.meshName
          }))
        });
        return;
      }

      const { candidate } = snapshot;
      console.debug(`[advanced-movement][${label}]`, {
        kind: candidate.kind,
        state: snapshot.state,
        isGrounded: snapshot.isGrounded,
        slopeAngle: roundValue(snapshot.slopeAngleDegrees ?? candidate.slopeAngleDegrees),
        velocity: toDebugPoint(snapshot.velocity),
        verticalVelocity: roundValue(snapshot.verticalVelocity),
        wallMesh: candidate.wallMesh.name,
        topMesh: candidate.topMesh.name,
        wallHitPoint: toDebugPoint(candidate.wallHitPoint),
        topHitPoint: toDebugPoint(candidate.topHitPoint),
        edgePoint: toDebugPoint(candidate.edgePoint),
        hangTargetPosition: toDebugPoint(candidate.hangPosition),
        climbEndPosition: toDebugPoint(candidate.climbEndPosition),
        standPoint: toDebugPoint(candidate.standPosition),
        wallNormal: toDebugPoint(candidate.wallNormal),
        topNormal: toDebugPoint(candidate.topNormal),
        characterRootPosition: toDebugPoint(snapshot.characterRootPosition),
        colliderCenterPosition: toDebugPoint(snapshot.colliderCenterPosition),
        ledgeHeight: roundValue(candidate.ledgeHeight),
        probes: candidate.probes.map((probe) => ({
          label: probe.label,
          hit: probe.hit,
          point: toDebugPoint(probe.point),
          normal: toDebugPoint(probe.normal),
          slopeAngle: probe.slopeAngleDegrees !== null ? roundValue(probe.slopeAngleDegrees) : null,
          meshName: probe.meshName
        }))
      });
    },
    dispose: () => {
      disposeProbeLines();
      Object.values(markers).forEach((marker) => {
        marker.dispose(false, true);
      });
      wallNormalLine.dispose(false, true);
      topNormalLine.dispose(false, true);
    }
  };
}
