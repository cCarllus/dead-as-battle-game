// Responsável por construir uma arena técnica 1000x1000 otimizada para validar locomoção, colisão e câmera.
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Scene
} from "@babylonjs/core";

export type MovementTestMapHandle = {
  meshes: AbstractMesh[];
  dispose: () => void;
};

function createMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = color.scale(0.08);
  material.emissiveColor = color.scale(0.02);
  return material;
}

function configureMesh(mesh: AbstractMesh): void {
  mesh.checkCollisions = true;
  mesh.isPickable = true;
  mesh.receiveShadows = true;
}

function createBox(
  scene: Scene,
  name: string,
  size: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number },
  material: StandardMaterial,
  parent?: TransformNode
): AbstractMesh {
  const mesh = MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) {
    mesh.parent = parent;
  }
  configureMesh(mesh);
  return mesh;
}

export function createMovementTestMap(scene: Scene): MovementTestMapHandle {
  const root = new TransformNode("Movement_Test_Map", scene);
  const groundMaterial = createMaterial(scene, "MovementTestGroundMaterial", new Color3(0.46, 0.47, 0.5));
  const obstacleMaterial = createMaterial(scene, "MovementTestObstacleMaterial", new Color3(0.34, 0.35, 0.38));
  const accentMaterial = createMaterial(scene, "MovementTestAccentMaterial", new Color3(0.58, 0.59, 0.63));

  const meshes: AbstractMesh[] = [];

  const ground = MeshBuilder.CreateGround(
    "MovementTestGround",
    {
      width: 1000,
      height: 1000,
      subdivisions: 20
    },
    scene
  );
  ground.material = groundMaterial;
  ground.parent = root;
  configureMesh(ground);
  meshes.push(ground);

  const perimeterHeight = 18;
  meshes.push(
    createBox(scene, "MovementTestNorthWall", { width: 1000, height: perimeterHeight, depth: 4 }, { x: 0, y: perimeterHeight / 2, z: 498 }, obstacleMaterial, root),
    createBox(scene, "MovementTestSouthWall", { width: 1000, height: perimeterHeight, depth: 4 }, { x: 0, y: perimeterHeight / 2, z: -498 }, obstacleMaterial, root),
    createBox(scene, "MovementTestWestWall", { width: 4, height: perimeterHeight, depth: 1000 }, { x: -498, y: perimeterHeight / 2, z: 0 }, obstacleMaterial, root),
    createBox(scene, "MovementTestEastWall", { width: 4, height: perimeterHeight, depth: 1000 }, { x: 498, y: perimeterHeight / 2, z: 0 }, obstacleMaterial, root)
  );

  const wallRunWallLeft = createBox(
    scene,
    "MovementTestWallRunLeft",
    { width: 6, height: 20, depth: 180 },
    { x: -120, y: 10, z: -120 },
    accentMaterial,
    root
  );
  const wallRunWallRight = createBox(
    scene,
    "MovementTestWallRunRight",
    { width: 6, height: 20, depth: 180 },
    { x: 120, y: 10, z: -120 },
    accentMaterial,
    root
  );
  meshes.push(wallRunWallLeft, wallRunWallRight);

  const rampA = createBox(
    scene,
    "MovementTestRampA",
    { width: 36, height: 6, depth: 100 },
    { x: -210, y: 3, z: 80 },
    obstacleMaterial,
    root
  );
  rampA.rotation.x = -Math.PI / 12;
  const rampB = createBox(
    scene,
    "MovementTestRampB",
    { width: 48, height: 8, depth: 128 },
    { x: 230, y: 4, z: 110 },
    obstacleMaterial,
    root
  );
  rampB.rotation.x = -Math.PI / 10;
  meshes.push(rampA, rampB);

  const platformLayouts = [
    { x: -90, y: 1.2, z: 210, width: 24, height: 2.4, depth: 24 },
    { x: -38, y: 2.8, z: 244, width: 24, height: 5.6, depth: 24 },
    { x: 28, y: 4.8, z: 274, width: 28, height: 9.6, depth: 28 },
    { x: 104, y: 7.2, z: 306, width: 34, height: 14.4, depth: 34 }
  ];

  platformLayouts.forEach((layout, index) => {
    meshes.push(
      createBox(
        scene,
        `MovementTestPlatform_${index + 1}`,
        {
          width: layout.width,
          height: layout.height,
          depth: layout.depth
        },
        {
          x: layout.x,
          y: layout.y,
          z: layout.z
        },
        accentMaterial,
        root
      )
    );
  });

  for (let index = 0; index < 16; index += 1) {
    const lane = index % 4;
    const row = Math.floor(index / 4);
    meshes.push(
      createBox(
        scene,
        `MovementTestObstacle_${index + 1}`,
        {
          width: 12 + lane * 4,
          height: 4 + row * 2,
          depth: 12
        },
        {
          x: -180 + lane * 44,
          y: 2 + row,
          z: -10 + row * 48
        },
        obstacleMaterial,
        root
      )
    );
  }

  const lowTunnel = createBox(
    scene,
    "MovementTestSlideTunnel",
    { width: 44, height: 3.4, depth: 68 },
    { x: 0, y: 1.7, z: -240 },
    accentMaterial,
    root
  );
  meshes.push(lowTunnel);

  const tunnelSupports = [
    { x: -20, y: 3.5, z: -240 },
    { x: 20, y: 3.5, z: -240 }
  ];
  tunnelSupports.forEach((support, index) => {
    meshes.push(
      createBox(
        scene,
        `MovementTestSlideTunnelSupport_${index + 1}`,
        { width: 6, height: 7, depth: 6 },
        support,
        obstacleMaterial,
        root
      )
    );
  });

  return {
    meshes,
    dispose: () => {
      root.dispose(false, true);
      groundMaterial.dispose(true, true);
      obstacleMaterial.dispose(true, true);
      accentMaterial.dispose(true, true);
    }
  };
}

