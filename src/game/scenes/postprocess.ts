import { Color4, ImageProcessingConfiguration, Scene } from "@babylonjs/core";

export function applyStylizedPostProcess(scene: Scene): void {
  scene.clearColor = new Color4(0.04, 0.06, 0.1, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.1;
  scene.imageProcessingConfiguration.contrast = 1.08;
  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.015;
}
