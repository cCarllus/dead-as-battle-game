// Responsável por carregar o mapa da arena multiplayer e fornecer fallback visual em caso de falha.
import { Color3, MeshBuilder, Scene, SceneLoader, StandardMaterial, type AbstractMesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export const GLOBAL_MATCH_MAP_URL =
  "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/models/maps/lightcycle_arena_rev_02__tebg.glb";

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
