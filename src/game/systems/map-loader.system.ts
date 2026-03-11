// Responsável por carregar o mapa técnico de gameplay e manter fallback para arenas externas futuras.
import { Color3, MeshBuilder, Scene, SceneLoader, StandardMaterial, type AbstractMesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { createMovementTestMap } from "../environment/movement-test-map";

export const GLOBAL_MATCH_MAP_URL = "movement-test-map";

function splitModelPath(modelUrl: string): { rootUrl: string; fileName: string } {
  const lastSlash = modelUrl.lastIndexOf("/");
  if (lastSlash < 0) {
    return { rootUrl: "/", fileName: modelUrl };
  }

  return {
    rootUrl: modelUrl.slice(0, lastSlash + 1),
    fileName: modelUrl.slice(lastSlash + 1)
  };
}

export type LoadedMapHandle = {
  meshes: AbstractMesh[];
  dispose: () => void;
};

function createFallbackArena(scene: Scene): LoadedMapHandle {
  const material = new StandardMaterial("globalMatchFallbackGroundMaterial", scene);
  material.diffuseColor = new Color3(0.06, 0.12, 0.2);
  material.emissiveColor = new Color3(0.02, 0.06, 0.12);
  material.specularColor = new Color3(0.12, 0.2, 0.3);

  const ground = MeshBuilder.CreateGround(
    "globalMatchFallbackGround",
    {
      width: 120,
      height: 120,
      subdivisions: 4
    },
    scene
  );

  ground.material = material;
  ground.checkCollisions = true;
  ground.isPickable = true;

  return {
    meshes: [ground],
    dispose: () => {
      ground.dispose();
      material.dispose();
    }
  };
}

export async function loadGlobalMatchMap(scene: Scene, mapUrl: string): Promise<LoadedMapHandle> {
  if (mapUrl === GLOBAL_MATCH_MAP_URL) {
    return createMovementTestMap(scene);
  }

  const { rootUrl, fileName } = splitModelPath(mapUrl);

  try {
    const result = await SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene);

    const loadedMeshes = result.meshes.filter((mesh): mesh is AbstractMesh => {
      return !mesh.isDisposed() && !!mesh.getIndices();
    });

    loadedMeshes.forEach((mesh) => {
      mesh.checkCollisions = true;
      mesh.isPickable = true;
    });

    const rootMeshes = loadedMeshes.filter((mesh) => !mesh.parent);

    return {
      meshes: loadedMeshes,
      dispose: () => {
        rootMeshes.forEach((mesh) => {
          mesh.dispose();
        });
      }
    };
  } catch (error) {
    console.warn("[global_match] Failed to load arena map, using fallback ground.", error);
    return createFallbackArena(scene);
  }
}
