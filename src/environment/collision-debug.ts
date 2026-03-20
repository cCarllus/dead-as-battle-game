// Responsável por expor marcadores visuais opcionais para debugging de checks de chão/parede do personagem.
import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene, type TransformNode } from "@babylonjs/core";

export type CollisionDebugHandle = {
  attach: (node: TransformNode, color: Color3) => void;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

export function createCollisionDebug(scene: Scene): CollisionDebugHandle {
  const debugMeshes: Mesh[] = [];
  let enabled = false;

  return {
    attach: (node, color) => {
      const material = new StandardMaterial(`CollisionDebugMaterial_${node.name}`, scene);
      material.emissiveColor = color;
      material.disableLighting = true;

      const sphere = MeshBuilder.CreateSphere(
        `CollisionDebug_${node.name}`,
        { diameter: 0.12, segments: 8 },
        scene
      );
      sphere.parent = node;
      sphere.material = material;
      sphere.isPickable = false;
      sphere.isVisible = enabled;
      debugMeshes.push(sphere);
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      debugMeshes.forEach((mesh) => {
        mesh.isVisible = enabled;
      });
    },
    dispose: () => {
      debugMeshes.forEach((mesh) => {
        mesh.dispose(false, true);
      });
      debugMeshes.length = 0;
    }
  };
}
