// Responsável por configurar luz principal, luz de preenchimento e sombras dinâmicas focadas no gameplay.
import {
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  Vector3,
  type AbstractMesh,
  type Scene,
  type TransformNode
} from "@babylonjs/core";

export type LightingSystem = {
  setMapMeshes: (meshes: AbstractMesh[]) => void;
  syncPlayerShadowCasters: (visualRoots: TransformNode[]) => void;
  dispose: () => void;
};

export type CreateLightingSystemOptions = {
  scene: Scene;
};

const SHADOW_MAP_SIZE = 2048;

export function createLightingSystem(options: CreateLightingSystemOptions): LightingSystem {
  const keyLight = new DirectionalLight(
    "globalMatchDirectionalKeyLight",
    new Vector3(-0.34, -1, 0.26),
    options.scene
  );
  keyLight.position = new Vector3(28, 42, -24);
  keyLight.intensity = 1.15;

  const fillLight = new HemisphericLight(
    "globalMatchFillLight",
    new Vector3(0.1, 1, -0.2),
    options.scene
  );
  fillLight.intensity = 0.34;

  const shadowGenerator = new ShadowGenerator(SHADOW_MAP_SIZE, keyLight);
  shadowGenerator.useExponentialShadowMap = true;
  shadowGenerator.blurScale = 2;
  shadowGenerator.bias = 0.00018;
  shadowGenerator.normalBias = 0.03;
  shadowGenerator.darkness = 0.45;

  const shadowCasterMeshIds = new Set<number>();

  const addShadowCasterMesh = (mesh: AbstractMesh): void => {
    if (mesh.isDisposed()) {
      return;
    }

    if (shadowCasterMeshIds.has(mesh.uniqueId)) {
      return;
    }

    shadowCasterMeshIds.add(mesh.uniqueId);
    shadowGenerator.addShadowCaster(mesh, true);
  };

  return {
    setMapMeshes: (meshes) => {
      meshes.forEach((mesh) => {
        if (mesh.isDisposed()) {
          return;
        }

        mesh.receiveShadows = true;
      });
    },
    syncPlayerShadowCasters: (visualRoots) => {
      visualRoots.forEach((root) => {
        if (root.isDisposed()) {
          return;
        }

        root.getChildMeshes(false).forEach((mesh) => {
          addShadowCasterMesh(mesh);
        });
      });
    },
    dispose: () => {
      shadowCasterMeshIds.clear();
      shadowGenerator.dispose();
      keyLight.dispose();
      fillLight.dispose();
    }
  };
}
