// Responsável por desenhar guias e marcadores de alinhamento entre collider, root e malha visual do personagem.
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type AbstractMesh,
  type Mesh,
  type Scene,
  type TransformNode
} from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "../character/character-config";
import type { CharacterColliderProfileConfig } from "../character/character-collider-config";

export type ColliderDebugHandle = {
  setEnabled: (enabled: boolean) => void;
  syncRuntimeConfig: (runtimeConfig: CharacterRuntimeConfig) => void;
  render: () => void;
  dispose: () => void;
};

export type CreateColliderDebugOptions = {
  scene: Scene;
  characterRoot: TransformNode;
  visualRoot: TransformNode;
  collisionBody: AbstractMesh;
  runtimeConfig: CharacterRuntimeConfig;
};

function createWireframeMaterial(scene: Scene, name: string, color: Color3, alpha: number): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(0.65);
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.wireframe = true;
  material.backFaceCulling = false;
  material.alpha = alpha;
  return material;
}

function createMarkerMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color;
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  return material;
}

function createMarker(scene: Scene, name: string, color: Color3, diameter = 0.08): Mesh {
  const marker = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
  marker.material = createMarkerMaterial(scene, `${name}_Material`, color);
  marker.isPickable = false;
  marker.isVisible = false;
  return marker;
}

function setVisibility(meshes: Mesh[], enabled: boolean): void {
  meshes.forEach((mesh) => {
    mesh.isVisible = enabled;
  });
}

function applyGuideProfile(
  guideMesh: Mesh,
  baseProfile: CharacterColliderProfileConfig,
  targetProfile: CharacterColliderProfileConfig
): void {
  guideMesh.scaling.set(
    targetProfile.radius / Math.max(0.001, baseProfile.radius),
    targetProfile.height / Math.max(0.001, baseProfile.height),
    targetProfile.radius / Math.max(0.001, baseProfile.radius)
  );
  guideMesh.position.set(0, targetProfile.centerY, 0);
}

export function createColliderDebug(options: CreateColliderDebugOptions): ColliderDebugHandle {
  let enabled = false;
  let runtimeConfig = options.runtimeConfig;
  const baseProfile = runtimeConfig.collider.standing;

  const standingGuideMaterial = createWireframeMaterial(
    options.scene,
    `ColliderStandingGuideMaterial_${options.characterRoot.uniqueId}`,
    new Color3(0.16, 0.88, 1),
    0.28
  );
  const crouchGuideMaterial = createWireframeMaterial(
    options.scene,
    `ColliderCrouchGuideMaterial_${options.characterRoot.uniqueId}`,
    new Color3(1, 0.58, 0.12),
    0.2
  );

  const standingGuide = MeshBuilder.CreateCapsule(
    `ColliderStandingGuide_${options.characterRoot.uniqueId}`,
    {
      height: baseProfile.height,
      radius: baseProfile.radius,
      tessellation: 18
    },
    options.scene
  );
  standingGuide.parent = options.characterRoot;
  standingGuide.material = standingGuideMaterial;
  standingGuide.isPickable = false;
  standingGuide.isVisible = false;

  const crouchGuide = MeshBuilder.CreateCapsule(
    `ColliderCrouchGuide_${options.characterRoot.uniqueId}`,
    {
      height: baseProfile.height,
      radius: baseProfile.radius,
      tessellation: 18
    },
    options.scene
  );
  crouchGuide.parent = options.characterRoot;
  crouchGuide.material = crouchGuideMaterial;
  crouchGuide.isPickable = false;
  crouchGuide.isVisible = false;

  const rootMarker = createMarker(
    options.scene,
    `ColliderRootMarker_${options.characterRoot.uniqueId}`,
    Color3.FromHexString("#ffffff"),
    0.1
  );
  rootMarker.parent = options.characterRoot;

  const visualRootMarker = createMarker(
    options.scene,
    `ColliderVisualRootMarker_${options.characterRoot.uniqueId}`,
    Color3.FromHexString("#60a5fa"),
    0.09
  );
  visualRootMarker.parent = options.visualRoot;

  const colliderBaseMarker = createMarker(
    options.scene,
    `ColliderBaseMarker_${options.characterRoot.uniqueId}`,
    Color3.FromHexString("#fde047")
  );
  const colliderTopMarker = createMarker(
    options.scene,
    `ColliderTopMarker_${options.characterRoot.uniqueId}`,
    Color3.FromHexString("#f87171")
  );
  const colliderCenterMarker = createMarker(
    options.scene,
    `ColliderCenterMarker_${options.characterRoot.uniqueId}`,
    Color3.FromHexString("#22c55e")
  );
  const visualFeetMarker = createMarker(
    options.scene,
    `ColliderFeetMarker_${options.characterRoot.uniqueId}`,
    Color3.FromHexString("#a3e635")
  );

  const looseMarkers = [colliderBaseMarker, colliderTopMarker, colliderCenterMarker, visualFeetMarker];
  const allMeshes = [
    standingGuide,
    crouchGuide,
    rootMarker,
    visualRootMarker,
    ...looseMarkers
  ];

  const syncGuideProfiles = (): void => {
    applyGuideProfile(standingGuide, baseProfile, runtimeConfig.collider.standing);
    applyGuideProfile(crouchGuide, baseProfile, runtimeConfig.collider.crouch);
  };

  syncGuideProfiles();

  return {
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      setVisibility(allMeshes, enabled);
    },
    syncRuntimeConfig: (nextRuntimeConfig) => {
      runtimeConfig = nextRuntimeConfig;
      syncGuideProfiles();
    },
    render: () => {
      if (!enabled) {
        return;
      }

      options.collisionBody.computeWorldMatrix(true);
      const colliderBounds = options.collisionBody.getBoundingInfo().boundingBox;
      const colliderCenter = colliderBounds.centerWorld;

      colliderBaseMarker.position.set(colliderCenter.x, colliderBounds.minimumWorld.y, colliderCenter.z);
      colliderTopMarker.position.set(colliderCenter.x, colliderBounds.maximumWorld.y, colliderCenter.z);
      colliderCenterMarker.position.copyFrom(colliderCenter);

      const visualMeshes = options.visualRoot.getChildMeshes(false);
      if (visualMeshes.length === 0) {
        visualFeetMarker.isVisible = false;
        return;
      }

      options.visualRoot.computeWorldMatrix(true);
      const visualBounds = options.visualRoot.getHierarchyBoundingVectors(true);
      visualFeetMarker.position.set(
        (visualBounds.min.x + visualBounds.max.x) * 0.5,
        visualBounds.min.y,
        (visualBounds.min.z + visualBounds.max.z) * 0.5
      );
      visualFeetMarker.isVisible = true;
    },
    dispose: () => {
      allMeshes.forEach((mesh) => {
        mesh.material?.dispose(false, true);
        mesh.dispose(false, true);
      });
    }
  };
}
