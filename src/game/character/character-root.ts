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
  rootDebugBody: AbstractMesh;
  groundCheck: TransformNode;
  wallCheckLeft: TransformNode;
  wallCheckRight: TransformNode;
  visualRoot: TransformNode;
  vfxRoot: TransformNode;
  vfxAnchors: {
    sprint: TransformNode;
    rolling: TransformNode;
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

export function syncCharacterRuntimeRigAnchors(
  rig: Pick<
    CharacterRuntimeRig,
    "groundCheck" | "wallCheckLeft" | "wallCheckRight" | "audioRoot" | "nameplateAnchor" | "cameraTargetAnchor"
  >,
  runtimeConfig: CharacterRuntimeConfig
): void {
  rig.groundCheck.position.y = runtimeConfig.anchors.groundCheckOffsetY;

  rig.wallCheckLeft.position.set(
    -runtimeConfig.anchors.wallCheckHorizontalOffset,
    runtimeConfig.anchors.wallCheckOffsetY,
    0
  );
  rig.wallCheckRight.position.set(
    runtimeConfig.anchors.wallCheckHorizontalOffset,
    runtimeConfig.anchors.wallCheckOffsetY,
    0
  );

  rig.audioRoot.position.y = runtimeConfig.anchors.audioRootOffsetY;
  rig.nameplateAnchor.position.y = runtimeConfig.anchors.nameplateOffsetY;
  rig.cameraTargetAnchor.position.y = runtimeConfig.anchors.cameraTargetOffsetY;
}

export function createCharacterRoot(options: CreateCharacterRootOptions): CharacterRuntimeRig {
  const standingCollider = options.runtimeConfig.collider.standing;
  const root = new TransformNode(`CharacterRoot_${options.sessionId}`, options.scene);
  const networkRoot = new TransformNode(`NetworkRoot_${options.sessionId}`, options.scene);
  networkRoot.parent = root;

  const collisionMaterial = new StandardMaterial(`CollisionBodyMaterial_${options.sessionId}`, options.scene);
  collisionMaterial.diffuseColor = new Color3(0.98, 0.82, 0.08);
  collisionMaterial.alpha = 0.28;

  const rootDebugMaterial = new StandardMaterial(`RootDebugBodyMaterial_${options.sessionId}`, options.scene);
  rootDebugMaterial.diffuseColor = new Color3(0.16, 0.88, 1);
  rootDebugMaterial.emissiveColor = new Color3(0.1, 0.46, 0.55);
  rootDebugMaterial.specularColor = new Color3(0, 0, 0);
  rootDebugMaterial.alpha = 0.9;
  rootDebugMaterial.wireframe = true;
  rootDebugMaterial.disableLighting = true;
  rootDebugMaterial.backFaceCulling = false;

  const collisionBody = MeshBuilder.CreateCapsule(
    `CollisionBody_${options.sessionId}`,
    {
      height: standingCollider.height,
      radius: standingCollider.radius,
      tessellation: 18
    },
    options.scene
  );
  collisionBody.parent = root;
  collisionBody.material = collisionMaterial;
  collisionBody.isVisible = false;
  collisionBody.isPickable = false;
  collisionBody.position.y = standingCollider.centerY;

  // Guia visual opcional para inspecionar o envelope-base do root sem alterar o collider real.
  const rootDebugBody = MeshBuilder.CreateCylinder(
    `RootDebugBody_${options.sessionId}`,
    {
      height: standingCollider.height,
      diameter: standingCollider.radius * 2,
      tessellation: 24
    },
    options.scene
  );
  rootDebugBody.parent = root;
  rootDebugBody.material = rootDebugMaterial;
  rootDebugBody.isVisible = false;
  rootDebugBody.isPickable = false;
  rootDebugBody.position.y = standingCollider.centerY;

  const groundCheck = new TransformNode(`GroundCheck_${options.sessionId}`, options.scene);
  groundCheck.parent = root;

  const wallCheckLeft = new TransformNode(`WallCheckLeft_${options.sessionId}`, options.scene);
  wallCheckLeft.parent = root;

  const wallCheckRight = new TransformNode(`WallCheckRight_${options.sessionId}`, options.scene);
  wallCheckRight.parent = root;

  const visualRoot = new TransformNode(`VisualRoot_${options.sessionId}`, options.scene);
  visualRoot.parent = root;

  const vfxRoot = new TransformNode(`VFXAnchors_${options.sessionId}`, options.scene);
  vfxRoot.parent = visualRoot;

  const sprintAnchor = new TransformNode(`SprintVFXAnchor_${options.sessionId}`, options.scene);
  sprintAnchor.parent = vfxRoot;
  sprintAnchor.position.z = -0.28;

  const rollingAnchor = new TransformNode(`RollingVFXAnchor_${options.sessionId}`, options.scene);
  rollingAnchor.parent = vfxRoot;
  rollingAnchor.position.y = 0.18;
  rollingAnchor.position.z = 0.36;

  const ultimateAnchor = new TransformNode(`UltimateVFXAnchor_${options.sessionId}`, options.scene);
  ultimateAnchor.parent = vfxRoot;
  ultimateAnchor.position.y = 1.42;

  const audioRoot = new TransformNode(`AudioRoot_${options.sessionId}`, options.scene);
  audioRoot.parent = root;

  const nameplateAnchor = new TransformNode(`NameplateAnchor_${options.sessionId}`, options.scene);
  nameplateAnchor.parent = root;

  const cameraTargetAnchor = new TransformNode(`CameraTargetAnchor_${options.sessionId}`, options.scene);
  cameraTargetAnchor.parent = root;

  syncCharacterRuntimeRigAnchors(
    {
      groundCheck,
      wallCheckLeft,
      wallCheckRight,
      audioRoot,
      nameplateAnchor,
      cameraTargetAnchor
    },
    options.runtimeConfig
  );

  return {
    characterRoot: root,
    networkRoot,
    collisionBody,
    rootDebugBody,
    groundCheck,
    wallCheckLeft,
    wallCheckRight,
    visualRoot,
    vfxRoot,
    vfxAnchors: {
      sprint: sprintAnchor,
      rolling: rollingAnchor,
      ultimate: ultimateAnchor
    },
    audioRoot,
    nameplateAnchor,
    cameraTargetAnchor,
    dispose: () => {
      collisionMaterial.dispose(true, true);
      rootDebugMaterial.dispose(true, true);
      root.dispose(false, true);
    }
  };
}
