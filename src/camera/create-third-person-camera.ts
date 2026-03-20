import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";

import { GAME_CONFIG } from "@/config/game.config";

export interface ThirdPersonCameraOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  target: AbstractMesh;
}

export function createThirdPersonCamera(
  options: ThirdPersonCameraOptions
): ArcRotateCamera {
  const { camera: config } = GAME_CONFIG;
  const camera = new ArcRotateCamera(
    "main-camera",
    config.alpha,
    config.beta,
    config.radius,
    options.target.position.clone(),
    options.scene
  );

  camera.lockedTarget = options.target;
  camera.lowerBetaLimit = config.lowerBetaLimit;
  camera.upperBetaLimit = config.upperBetaLimit;
  camera.lowerRadiusLimit = config.lowerRadiusLimit;
  camera.upperRadiusLimit = config.upperRadiusLimit;
  camera.wheelDeltaPercentage = config.wheelDeltaPercentage;
  camera.panningSensibility = 0;
  camera.allowUpsideDown = false;
  camera.minZ = 0.1;
  camera.attachControl(options.canvas, true);

  options.scene.activeCamera = camera;

  return camera;
}
