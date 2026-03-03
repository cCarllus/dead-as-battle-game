import {
  Color3,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  Vector3,
  type Scene
} from "@babylonjs/core";

export function createPedestal(scene: Scene, position: Vector3 = Vector3.Zero()): void {
  const base = MeshBuilder.CreateCylinder("pedestal-base", { diameter: 3.2, height: 1.1 }, scene);
  base.position = position.add(new Vector3(0, 0.55, 0));

  const baseMaterial = new StandardMaterial("pedestal-base-material", scene);
  baseMaterial.diffuseColor = new Color3(0.18, 0.22, 0.34);
  base.material = baseMaterial;

  const ring = MeshBuilder.CreateTorus("pedestal-ring", { diameter: 2.8, thickness: 0.1 }, scene);
  ring.position = position.add(new Vector3(0, 1.12, 0));

  const ringMaterial = new StandardMaterial("pedestal-ring-material", scene);
  ringMaterial.emissiveColor = new Color3(0.14, 0.7, 1);
  ring.material = ringMaterial;

  const highlight = new PointLight("pedestal-highlight", position.add(new Vector3(0, 2.3, 0)), scene);
  highlight.intensity = 14;
  highlight.range = 12;
}
