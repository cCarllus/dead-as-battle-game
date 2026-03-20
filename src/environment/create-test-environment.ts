import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";

export interface TestEnvironment {
  readonly playerProxy: Mesh;
  readonly cameraTarget: Mesh;
}

export function createTestEnvironment(scene: Scene): TestEnvironment {
  const ground = MeshBuilder.CreateGround(
    "arena-ground",
    {
      width: 80,
      height: 80,
      subdivisions: 2
    },
    scene
  );
  const groundMaterial = new GridMaterial("arena-ground-grid", scene);
  groundMaterial.majorUnitFrequency = 10;
  groundMaterial.minorUnitVisibility = 0.35;
  groundMaterial.gridRatio = 2;
  groundMaterial.mainColor = Color3.FromHexString("#b8c5d8");
  groundMaterial.lineColor = Color3.FromHexString("#18212b");
  groundMaterial.opacity = 0.92;
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  const platformMaterial = new StandardMaterial("platform-material", scene);
  platformMaterial.diffuseColor = Color3.FromHexString("#3a4759");
  platformMaterial.specularColor = Color3.FromHexString("#101722");

  const block = MeshBuilder.CreateBox(
    "cover-block",
    {
      width: 3,
      height: 2.5,
      depth: 3
    },
    scene
  );
  block.position = new Vector3(5, 1.25, -2);
  block.material = platformMaterial;

  const ramp = MeshBuilder.CreateBox(
    "combat-ramp",
    {
      width: 4,
      height: 0.75,
      depth: 8
    },
    scene
  );
  ramp.position = new Vector3(-6, 1.5, 5);
  ramp.rotation.z = -0.35;
  ramp.material = platformMaterial;

  const signalOrb = MeshBuilder.CreateSphere(
    "signal-orb",
    {
      diameter: 1.4,
      segments: 24
    },
    scene
  );
  signalOrb.position = new Vector3(0, 2.4, -8);
  const orbMaterial = new StandardMaterial("signal-orb-material", scene);
  orbMaterial.emissiveColor = Color3.FromHexString("#e0823c");
  orbMaterial.diffuseColor = Color3.FromHexString("#472717");
  signalOrb.material = orbMaterial;

  const playerProxy = MeshBuilder.CreateCapsule(
    "player-proxy",
    {
      height: 2.2,
      radius: 0.45,
      tessellation: 24
    },
    scene
  );
  playerProxy.position = new Vector3(0, 1.1, 0);
  playerProxy.rotation.y = Math.PI / 4;
  const playerMaterial = new StandardMaterial("player-proxy-material", scene);
  playerMaterial.diffuseColor = Color3.FromHexString("#2d8cff");
  playerMaterial.specularColor = Color3.FromHexString("#d3e5ff");
  playerProxy.material = playerMaterial;

  const cameraTarget = MeshBuilder.CreateSphere(
    "camera-target",
    {
      diameter: 0.15
    },
    scene
  );
  cameraTarget.isVisible = false;
  cameraTarget.isPickable = false;
  cameraTarget.parent = playerProxy;
  cameraTarget.position = new Vector3(0, 0.8, 0);

  scene.onBeforeRenderObservable.add(() => {
    const elapsedSeconds = performance.now() * 0.001;

    signalOrb.rotation.y += scene.getEngine().getDeltaTime() * 0.0015;
    signalOrb.position.y = 2.4 + Math.sin(elapsedSeconds * 2) * 0.25;
  });

  return {
    playerProxy,
    cameraTarget
  };
}
