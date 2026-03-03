import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { CharacterId } from "./characterSelection";

export function createPlayer(scene: Scene, character: CharacterId): Mesh {
  const body = MeshBuilder.CreateCapsule(
    `${character}-player`,
    { height: 2.2, radius: 0.45, tessellation: 12 },
    scene
  );

  body.position = new Vector3(0, 1.1, 0);

  const material = new StandardMaterial(`${character}-material`, scene);

  if (character === "warrior") {
    material.diffuseColor = new Color3(0.75, 0.2, 0.2);
  } else if (character === "demon") {
    material.diffuseColor = new Color3(0.55, 0.15, 0.6);
  } else {
    material.diffuseColor = new Color3(0.2, 0.7, 0.9);
  }

  body.material = material;
  body.checkCollisions = true;

  return body;
}
