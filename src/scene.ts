import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  KeyboardEventTypes,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { CharacterId } from "./characterSelection";
import { createPlayer } from "./player";

export function createArenaScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  selectedCharacter: CharacterId
): { scene: Scene; player: Mesh } {
  const scene = new Scene(engine);
  scene.collisionsEnabled = true;

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.9;

  const floor = MeshBuilder.CreateGround("floor", { width: 50, height: 50 }, scene);
  const floorMaterial = new StandardMaterial("floor-material", scene);
  floorMaterial.diffuseColor = new Color3(0.12, 0.35, 0.12);
  floor.material = floorMaterial;
  floor.checkCollisions = true;

  const wallMaterial = new StandardMaterial("wall-material", scene);
  wallMaterial.diffuseColor = new Color3(0.22, 0.22, 0.26);

  const walls: Mesh[] = [];
  const boundary = 24;
  const wallHeight = 3;
  const wallThickness = 1;

  const northWall = MeshBuilder.CreateBox(
    "northWall",
    { width: 50, height: wallHeight, depth: wallThickness },
    scene
  );
  northWall.position = new Vector3(0, wallHeight / 2, boundary);
  walls.push(northWall);

  const southWall = northWall.clone("southWall") as Mesh;
  southWall.position = new Vector3(0, wallHeight / 2, -boundary);
  walls.push(southWall);

  const eastWall = MeshBuilder.CreateBox(
    "eastWall",
    { width: wallThickness, height: wallHeight, depth: 50 },
    scene
  );
  eastWall.position = new Vector3(boundary, wallHeight / 2, 0);
  walls.push(eastWall);

  const westWall = eastWall.clone("westWall") as Mesh;
  westWall.position = new Vector3(-boundary, wallHeight / 2, 0);
  walls.push(westWall);

  walls.forEach((wall) => {
    wall.material = wallMaterial;
    wall.checkCollisions = true;
  });

  const player = createPlayer(scene, selectedCharacter);

  const camera = new ArcRotateCamera("camera", Math.PI / 2, 1.1, 12, player.position, scene);
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 16;
  camera.wheelDeltaPercentage = 0.01;
  camera.attachControl(canvas, true);

  let forward = 0;
  let right = 0;

  scene.onKeyboardObservable.add((keyboardInfo) => {
    const isDown = keyboardInfo.type === KeyboardEventTypes.KEYDOWN;
    if (![KeyboardEventTypes.KEYDOWN, KeyboardEventTypes.KEYUP].includes(keyboardInfo.type)) {
      return;
    }

    switch (keyboardInfo.event.key.toLowerCase()) {
      case "w":
      case "arrowup":
        forward = isDown ? 1 : 0;
        break;
      case "s":
      case "arrowdown":
        forward = isDown ? -1 : 0;
        break;
      case "a":
      case "arrowleft":
        right = isDown ? -1 : 0;
        break;
      case "d":
      case "arrowright":
        right = isDown ? 1 : 0;
        break;
      default:
        break;
    }
  });

  scene.onBeforeRenderObservable.add(() => {
    const delta = engine.getDeltaTime() / 1000;
    const speed = 6;

    const inputVector = new Vector3(right, 0, forward);
    if (inputVector.lengthSquared() > 0) {
      inputVector.normalize();
      const move = inputVector.scale(speed * delta);
      player.moveWithCollisions(move);
      player.rotation.y = Math.atan2(move.x, move.z);
    }

    camera.target.copyFrom(player.position.add(new Vector3(0, 1, 0)));
  });

  return { scene, player };
}
