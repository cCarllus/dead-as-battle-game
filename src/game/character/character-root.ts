// Responsável por construir a hierarquia runtime padrão de personagem com roots, checks e anchors fixos.
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Scene
} from "@babylonjs/core";
import type { CharacterRuntimeConfig } from "./character-config";

export type CharacterRuntimeRig = {
  characterRoot: TransformNode;
  networkRoot: TransformNode;
  collisionBody: AbstractMesh;
  groundCheck: TransformNode;
  wallCheckLeft: TransformNode;
  wallCheckRight: TransformNode;
  visualRoot: TransformNode;
  vfxRoot: TransformNode;
  vfxAnchors: {
    sprint: TransformNode;
    slide: TransformNode;
    ultimate: TransformNode;
  };
  audioRoot: TransformNode;
  nameplateAnchor: TransformNode;
  cameraTargetAnchor: TransformNode;
  dispose: () => void;
};

export type CreateCharacterRootOptions = {
  scene: Scene;
  sessionId: string;
  runtimeConfig: CharacterRuntimeConfig;
};

export function createCharacterRoot(options: CreateCharacterRootOptions): CharacterRuntimeRig {
  const root = new TransformNode(`CharacterRoot_${options.sessionId}`, options.scene);
  const networkRoot = new TransformNode(`NetworkRoot_${options.sessionId}`, options.scene);
  networkRoot.parent = root;

  const collisionMaterial = new StandardMaterial(`CollisionBodyMaterial_${options.sessionId}`, options.scene);
  collisionMaterial.diffuseColor = new Color3(0.98, 0.82, 0.08);
  collisionMaterial.alpha = 0.28;

  const collisionBody = MeshBuilder.CreateCapsule(
    `CollisionBody_${options.sessionId}`,
    {
      height: options.runtimeConfig.colliderHeight,
      radius: options.runtimeConfig.colliderRadius,
      tessellation: 18
    },
    options.scene
  );
  collisionBody.parent = root;
  collisionBody.material = collisionMaterial;
  collisionBody.isVisible = false;
  collisionBody.isPickable = false;

  const groundCheck = new TransformNode(`GroundCheck_${options.sessionId}`, options.scene);
  groundCheck.parent = root;
  groundCheck.position.y = options.runtimeConfig.groundCheckOffsetY;

  const wallCheckLeft = new TransformNode(`WallCheckLeft_${options.sessionId}`, options.scene);
  wallCheckLeft.parent = root;
  wallCheckLeft.position.set(
    -options.runtimeConfig.wallCheckHorizontalOffset,
    options.runtimeConfig.wallCheckOffsetY,
    0
  );

  const wallCheckRight = new TransformNode(`WallCheckRight_${options.sessionId}`, options.scene);
  wallCheckRight.parent = root;
  wallCheckRight.position.set(
    options.runtimeConfig.wallCheckHorizontalOffset,
    options.runtimeConfig.wallCheckOffsetY,
    0
  );

  const visualRoot = new TransformNode(`VisualRoot_${options.sessionId}`, options.scene);
  visualRoot.parent = root;

  const vfxRoot = new TransformNode(`VFXAnchors_${options.sessionId}`, options.scene);
  vfxRoot.parent = visualRoot;

  const sprintAnchor = new TransformNode(`SprintVFXAnchor_${options.sessionId}`, options.scene);
  sprintAnchor.parent = vfxRoot;
  sprintAnchor.position.z = -0.28;

  const slideAnchor = new TransformNode(`SlideVFXAnchor_${options.sessionId}`, options.scene);
  slideAnchor.parent = vfxRoot;
  slideAnchor.position.y = 0.18;
  slideAnchor.position.z = 0.36;

  const ultimateAnchor = new TransformNode(`UltimateVFXAnchor_${options.sessionId}`, options.scene);
  ultimateAnchor.parent = vfxRoot;
  ultimateAnchor.position.y = 1.42;

  const audioRoot = new TransformNode(`AudioRoot_${options.sessionId}`, options.scene);
  audioRoot.parent = root;
  audioRoot.position.y = options.runtimeConfig.audioRootOffsetY;

  const nameplateAnchor = new TransformNode(`NameplateAnchor_${options.sessionId}`, options.scene);
  nameplateAnchor.parent = root;
  nameplateAnchor.position.y = options.runtimeConfig.nameplateOffsetY;

  const cameraTargetAnchor = new TransformNode(`CameraTargetAnchor_${options.sessionId}`, options.scene);
  cameraTargetAnchor.parent = root;
  cameraTargetAnchor.position.y = options.runtimeConfig.cameraTargetOffsetY;

  return {
    characterRoot: root,
    networkRoot,
    collisionBody,
    groundCheck,
    wallCheckLeft,
    wallCheckRight,
    visualRoot,
    vfxRoot,
    vfxAnchors: {
      sprint: sprintAnchor,
      slide: slideAnchor,
      ultimate: ultimateAnchor
    },
    audioRoot,
    nameplateAnchor,
    cameraTargetAnchor,
    dispose: () => {
      collisionMaterial.dispose(true, true);
      root.dispose(false, true);
    }
  };
}

