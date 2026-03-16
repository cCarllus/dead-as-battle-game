// Responsible for exposing visual camera tuning helpers without affecting normal gameplay.
import {
  Color3,
  LinesMesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene
} from "@babylonjs/core";

export type CameraDebugFrameInput = {
  focusPoint: Vector3;
  shoulderAnchor: Vector3;
  desiredCameraPosition: Vector3;
  finalCameraPosition: Vector3;
  currentFovRadians: number;
  targetFovRadians: number;
  locomotionState: string;
  collisionHit: boolean;
};

export type CameraDebugSystem = {
  render: (input: CameraDebugFrameInput) => void;
  dispose: () => void;
};

function createMarker(
  scene: Scene,
  name: string,
  color: Color3,
  diameter: number
): { mesh: Mesh; material: StandardMaterial } {
  const material = new StandardMaterial(`${name}Material`, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(0.7);
  material.specularColor = Color3.Black();
  material.disableLighting = true;

  const mesh = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
  mesh.isPickable = false;
  mesh.material = material;
  mesh.isVisible = false;

  return { mesh, material };
}

function isCameraDebugEnabled(): boolean {
  const globals = globalThis as { __DAB_CAMERA_DEBUG__?: unknown };
  if (globals.__DAB_CAMERA_DEBUG__ === true) {
    return true;
  }

  if (globals.__DAB_CAMERA_DEBUG__ === false) {
    return false;
  }

  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("debugCamera") === "1";
    } catch {
      return false;
    }
  }

  return false;
}

export function createCameraDebugSystem(
  scene: Scene,
  debugLogIntervalMs: number
): CameraDebugSystem {
  const focusMarker = createMarker(scene, "dabCameraFocusMarker", new Color3(1, 0.25, 0.25), 0.12);
  const shoulderMarker = createMarker(scene, "dabCameraShoulderMarker", new Color3(0.25, 0.78, 1), 0.12);
  const finalMarker = createMarker(scene, "dabCameraFinalMarker", new Color3(1, 0.92, 0.25), 0.14);
  let collisionLine: LinesMesh | null = null;
  let lastLogAtMs = 0;

  const setVisible = (visible: boolean): void => {
    focusMarker.mesh.isVisible = visible;
    shoulderMarker.mesh.isVisible = visible;
    finalMarker.mesh.isVisible = visible;
    if (collisionLine) {
      collisionLine.isVisible = visible;
    }
  };

  return {
    render: (input) => {
      const enabled = isCameraDebugEnabled();
      setVisible(enabled);
      if (!enabled) {
        return;
      }

      focusMarker.mesh.position.copyFrom(input.focusPoint);
      shoulderMarker.mesh.position.copyFrom(input.shoulderAnchor);
      finalMarker.mesh.position.copyFrom(input.finalCameraPosition);

      const lineColor = input.collisionHit ? new Color3(1, 0.45, 0.25) : new Color3(0.3, 1, 0.45);
      collisionLine = MeshBuilder.CreateLines(
        "dabCameraCollisionRay",
        {
          points: [input.focusPoint, input.desiredCameraPosition],
          instance: collisionLine ?? undefined,
          updatable: true
        },
        scene
      );
      collisionLine.isPickable = false;
      collisionLine.color = lineColor;
      collisionLine.isVisible = true;

      const now = Date.now();
      if (now - lastLogAtMs < debugLogIntervalMs) {
        return;
      }

      lastLogAtMs = now;
      console.debug("[camera][debug]", {
        locomotionState: input.locomotionState,
        collisionHit: input.collisionHit,
        currentFovDegrees: Math.round((input.currentFovRadians * 180) / Math.PI * 10) / 10,
        targetFovDegrees: Math.round((input.targetFovRadians * 180) / Math.PI * 10) / 10,
        focusPoint: {
          x: Math.round(input.focusPoint.x * 1000) / 1000,
          y: Math.round(input.focusPoint.y * 1000) / 1000,
          z: Math.round(input.focusPoint.z * 1000) / 1000
        },
        finalCameraPosition: {
          x: Math.round(input.finalCameraPosition.x * 1000) / 1000,
          y: Math.round(input.finalCameraPosition.y * 1000) / 1000,
          z: Math.round(input.finalCameraPosition.z * 1000) / 1000
        }
      });
    },
    dispose: () => {
      collisionLine?.dispose();
      focusMarker.mesh.dispose();
      focusMarker.material.dispose();
      shoulderMarker.mesh.dispose();
      shoulderMarker.material.dispose();
      finalMarker.mesh.dispose();
      finalMarker.material.dispose();
    }
  };
}
