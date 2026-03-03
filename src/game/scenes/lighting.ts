import { DirectionalLight, HemisphericLight, Vector3, type Scene } from "@babylonjs/core";

export function applyFortniteLighting(scene: Scene): void {
  const hemi = new HemisphericLight("hemi-light", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.85;

  const sun = new DirectionalLight("sun-light", new Vector3(-0.5, -1, 0.3), scene);
  sun.position = new Vector3(20, 30, -10);
  sun.intensity = 1.2;
}
