import {
  ArcRotateCamera,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type Engine
} from "@babylonjs/core";
import { createPlayerController } from "../entities/player/player.controller";
import { createPlayer } from "../entities/player/player.factory";
import type { CharacterId } from "../entities/player/player.types";
import { applyFortniteLighting } from "./lighting";
import { applyStylizedPostProcess } from "./postprocess";

export function createArenaScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  selectedCharacter: CharacterId
): { scene: Scene; player: Mesh } {
  const scene = new Scene(engine);
  scene.collisionsEnabled = true;

  applyStylizedPostProcess(scene);
  applyFortniteLighting(scene);

  const floor = MeshBuilder.CreateGround("arena-floor", { width: 50, height: 50 }, scene);
  const floorMaterial = new StandardMaterial("arena-floor-material", scene);
  floorMaterial.diffuseColor = new Color3(0.12, 0.35, 0.12);
  floor.material = floorMaterial;
  floor.checkCollisions = true;

  const wallMaterial = new StandardMaterial("arena-wall-material", scene);
  wallMaterial.diffuseColor = new Color3(0.22, 0.22, 0.26);

  const walls: Mesh[] = [];
  const boundary = 24;
  const wallHeight = 3;
  const wallThickness = 1;

  const northWall = MeshBuilder.CreateBox(
    "north-wall",
    { width: 50, height: wallHeight, depth: wallThickness },
    scene
  );
  northWall.position = new Vector3(0, wallHeight / 2, boundary);
  walls.push(northWall);

  const southWall = northWall.clone("south-wall") as Mesh;
  southWall.position = new Vector3(0, wallHeight / 2, -boundary);
  walls.push(southWall);

  const eastWall = MeshBuilder.CreateBox(
    "east-wall",
    { width: wallThickness, height: wallHeight, depth: 50 },
    scene
  );
  eastWall.position = new Vector3(boundary, wallHeight / 2, 0);
  walls.push(eastWall);

  const westWall = eastWall.clone("west-wall") as Mesh;
  westWall.position = new Vector3(-boundary, wallHeight / 2, 0);
  walls.push(westWall);

  walls.forEach((wall) => {
    wall.material = wallMaterial;
    wall.checkCollisions = true;
  });

  const player = createPlayer(scene, selectedCharacter, {
    position: new Vector3(0, 1.1, 0),
    collisions: true,
    showCollider: false
  });

  const camera = new ArcRotateCamera("arena-camera", Math.PI / 2, 1.1, 12, player.mesh.position, scene);
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 16;
  camera.wheelDeltaPercentage = 0.01;
  camera.attachControl(canvas, true);

  const controller = createPlayerController(scene, engine, player.mesh, camera);
  scene.onDisposeObservable.add(() => controller.dispose());

  return { scene, player: player.mesh };
}
