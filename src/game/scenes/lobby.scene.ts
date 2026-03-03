import {
  ArcRotateCamera,
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type Engine
} from "@babylonjs/core";
import { createPlayer } from "../entities/player/player.factory";
import type { CharacterId } from "../entities/player/player.types";
import { applyFortniteLighting } from "./lighting";
import { createPedestal } from "./pedestal";
import { applyStylizedPostProcess } from "./postprocess";

export function createLobbyScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  selectedCharacter: CharacterId
): { scene: Scene } {
  const scene = new Scene(engine);
  applyStylizedPostProcess(scene);
  applyFortniteLighting(scene);

  const floor = MeshBuilder.CreateGround("lobby-floor", { width: 18, height: 18, subdivisions: 2 }, scene);
  const floorMaterial = new StandardMaterial("lobby-floor-material", scene);
  floorMaterial.diffuseColor = new Color3(0.08, 0.11, 0.16);
  floor.material = floorMaterial;

  createPedestal(scene, Vector3.Zero());

  const player = createPlayer(scene, selectedCharacter, {
    position: new Vector3(0, 2.2, 0),
    collisions: false,
    showCollider: false
  });

  const camera = new ArcRotateCamera("lobby-camera", Math.PI / 2, 1.1, 8, new Vector3(0, 1.8, 0), scene);
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 10;
  camera.wheelDeltaPercentage = 0.01;
  camera.attachControl(canvas, true);

  scene.onBeforeRenderObservable.add(() => {
    player.mesh.rotation.y += engine.getDeltaTime() * 0.001;
  });

  return { scene };
}
