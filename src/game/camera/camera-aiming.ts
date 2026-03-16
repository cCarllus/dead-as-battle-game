// Responsible for resolving the shoulder-camera aim ray and world-space aim point from the shifted crosshair.
import { Matrix, Vector3, type AbstractMesh, type Camera, type Scene } from "@babylonjs/core";
import {
  DEFAULT_SHOULDER_CROSSHAIR_CONFIG,
  resolveCrosshairNormalizedScreenPosition,
  type ShoulderCrosshairConfig
} from "./crosshair-config";

export type CameraAimState = {
  normalizedScreenX: number;
  normalizedScreenY: number;
  screenX: number;
  screenY: number;
  scale: number;
  opacity: number;
  rayOrigin: Vector3;
  rayDirection: Vector3;
  aimPoint: Vector3;
  hitPoint: Vector3 | null;
  hasHit: boolean;
};

export type CameraAimingSystem = {
  sample: () => CameraAimState;
  dispose: () => void;
};

export type CreateCameraAimingSystemOptions = {
  scene: Scene;
  camera: Camera;
  crosshairConfig?: Partial<ShoulderCrosshairConfig>;
  getShoulderSide?: () => number;
};

function canAimAt(mesh: AbstractMesh | null): mesh is AbstractMesh {
  return (
    !!mesh &&
    !mesh.isDisposed() &&
    mesh.isEnabled() &&
    mesh.isVisible &&
    mesh.isPickable
  );
}

function mergeCrosshairConfig(
  config?: Partial<ShoulderCrosshairConfig>
): ShoulderCrosshairConfig {
  return {
    ...DEFAULT_SHOULDER_CROSSHAIR_CONFIG,
    ...config
  };
}

export function createCameraAimingSystem(
  options: CreateCameraAimingSystemOptions
): CameraAimingSystem {
  const crosshairConfig = mergeCrosshairConfig(options.crosshairConfig);

  return {
    sample: () => {
      const engine = options.scene.getEngine();
      const renderWidth = engine.getRenderWidth(true);
      const renderHeight = engine.getRenderHeight(true);
      const normalizedScreenPosition = resolveCrosshairNormalizedScreenPosition(
        crosshairConfig,
        options.getShoulderSide?.() ?? 1
      );
      const viewport = options.camera.viewport.toGlobal(renderWidth, renderHeight);
      const screenX = viewport.x + viewport.width * normalizedScreenPosition.x;
      const screenY = viewport.y + viewport.height * normalizedScreenPosition.y;
      const ray = options.scene.createPickingRay(
        screenX,
        screenY,
        Matrix.Identity(),
        options.camera
      );
      const pick = options.scene.pickWithRay(ray, canAimAt, false);
      const hitPoint = pick?.hit ? pick.pickedPoint?.clone() ?? null : null;
      const aimPoint =
        hitPoint ??
        ray.origin.add(ray.direction.scale(crosshairConfig.aimMaxDistance));

      return {
        normalizedScreenX: normalizedScreenPosition.x,
        normalizedScreenY: normalizedScreenPosition.y,
        screenX,
        screenY,
        scale: crosshairConfig.scale,
        opacity: crosshairConfig.opacity,
        rayOrigin: ray.origin.clone(),
        rayDirection: ray.direction.clone(),
        aimPoint,
        hitPoint,
        hasHit: hitPoint !== null
      };
    },
    dispose: () => {}
  };
}
