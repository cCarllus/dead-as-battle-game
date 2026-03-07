// Responsável por construir um player desacoplado em duas camadas: gameplay autoritativo e visual.
import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { resolveHeroConfig, type HeroConfig } from "../config/hero-config";
import type { MatchPlayerState } from "../../models/match-player.model";

const PLAYER_COLLISION_HEIGHT = 2.4;
const PLAYER_COLLISION_RADIUS = 0.44;
const CAMERA_TARGET_OFFSET_Y = 1.28;
const NAMEPLATE_OFFSET_Y = PLAYER_COLLISION_HEIGHT + 0.52;

export type PlayerVisualStyle = {
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
};

type PlayerLabelHandle = {
  mesh: AbstractMesh;
  setText: (text: string, textColor: string) => void;
  dispose: () => void;
};

function createPlayerLabel(scene: Scene, sessionId: string): PlayerLabelHandle {
  const texture = new DynamicTexture(
    `matchPlayerLabelTexture_${sessionId}`,
    { width: 512, height: 128 },
    scene,
    true
  );
  texture.hasAlpha = true;

  const material = new StandardMaterial(`matchPlayerLabelMaterial_${sessionId}`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;

  const plane = MeshBuilder.CreatePlane(
    `matchPlayerLabel_${sessionId}`,
    { width: 2.6, height: 0.58 },
    scene
  );
  plane.material = material;
  plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
  plane.position = new Vector3(0, NAMEPLATE_OFFSET_Y, 0);
  plane.isPickable = false;

  return {
    mesh: plane,
    setText: (text, textColor) => {
      texture.clear();
      texture.drawText(
        text,
        null,
        88,
        "bold 56px Rajdhani",
        textColor,
        "transparent",
        true
      );
    },
    dispose: () => {
      if (!plane.isDisposed()) {
        plane.dispose(false, true);
      }
      material.dispose(true, true);
      texture.dispose();
    }
  };
}

function applyHeroVisualConfig(visualRoot: TransformNode, heroConfig: HeroConfig): void {
  const safeScale =
    Number.isFinite(heroConfig.visualScale) && heroConfig.visualScale > 0
      ? heroConfig.visualScale
      : 1;

  visualRoot.position.set(
    heroConfig.visualOffset.x,
    heroConfig.visualOffset.y,
    heroConfig.visualOffset.z
  );
  visualRoot.rotation.set(0, heroConfig.visualYaw, 0);
  visualRoot.scaling.set(safeScale, safeScale, safeScale);
}

export type MatchPlayerEntity = {
  sessionId: string;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  visualRoot: TransformNode;
  nameplateNode: AbstractMesh;
  setTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
  getTransform: () => { x: number; y: number; z: number; rotationY: number };
  getCameraTarget: () => Vector3;
  setNickname: (nickname: string) => void;
  setVisualStyle: (style: PlayerVisualStyle) => void;
  applyHeroConfig: (heroId: string) => void;
  dispose: () => void;
};

export type CreateMatchPlayerEntityOptions = {
  scene: Scene;
  player: MatchPlayerState;
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
};

export function createMatchPlayerEntity(options: CreateMatchPlayerEntityOptions): MatchPlayerEntity {
  const gameplayRoot = new TransformNode(
    `matchPlayerGameplayRoot_${options.player.sessionId}`,
    options.scene
  );
  const visualRoot = new TransformNode(
    `matchPlayerVisualRoot_${options.player.sessionId}`,
    options.scene
  );
  visualRoot.parent = gameplayRoot;

  const collisionMaterial = new StandardMaterial(
    `matchPlayerCollisionMaterial_${options.player.sessionId}`,
    options.scene
  );

  const collisionBody = MeshBuilder.CreateCapsule(
    `matchPlayerCollisionBody_${options.player.sessionId}`,
    {
      height: PLAYER_COLLISION_HEIGHT,
      radius: PLAYER_COLLISION_RADIUS,
      tessellation: 18
    },
    options.scene
  );
  collisionBody.parent = gameplayRoot;
  collisionBody.material = collisionMaterial;
  collisionBody.isPickable = false;

  const label = createPlayerLabel(options.scene, options.player.sessionId);
  label.mesh.parent = gameplayRoot;

  let isDisposed = false;
  let style: PlayerVisualStyle = {
    accentColorHex: options.accentColorHex,
    labelColorHex: options.labelColorHex,
    labelPrefix: options.labelPrefix
  };
  let nickname = options.player.nickname;

  const applyDisplay = (): void => {
    const accentColor = Color3.FromHexString(style.accentColorHex);
    collisionMaterial.diffuseColor = accentColor;
    collisionMaterial.emissiveColor = accentColor.scale(0.22);
    collisionMaterial.specularColor = accentColor.scale(0.35);

    label.setText(`${style.labelPrefix ?? ""}${nickname}`, style.labelColorHex);
  };

  applyDisplay();
  applyHeroVisualConfig(visualRoot, resolveHeroConfig(options.player.heroId));

  gameplayRoot.position.set(options.player.x, options.player.y, options.player.z);
  gameplayRoot.rotation.y = options.player.rotationY;

  return {
    sessionId: options.player.sessionId,
    gameplayRoot,
    collisionBody,
    visualRoot,
    nameplateNode: label.mesh,
    setTransform: (transform) => {
      gameplayRoot.position.set(transform.x, transform.y, transform.z);
      gameplayRoot.rotation.y = transform.rotationY;
    },
    getTransform: () => {
      return {
        x: gameplayRoot.position.x,
        y: gameplayRoot.position.y,
        z: gameplayRoot.position.z,
        rotationY: gameplayRoot.rotation.y
      };
    },
    getCameraTarget: () => {
      return new Vector3(
        gameplayRoot.position.x,
        gameplayRoot.position.y + CAMERA_TARGET_OFFSET_Y,
        gameplayRoot.position.z
      );
    },
    setNickname: (nextNickname) => {
      nickname = nextNickname;
      applyDisplay();
    },
    setVisualStyle: (nextStyle) => {
      style = {
        accentColorHex: nextStyle.accentColorHex,
        labelColorHex: nextStyle.labelColorHex,
        labelPrefix: nextStyle.labelPrefix
      };
      applyDisplay();
    },
    applyHeroConfig: (heroId) => {
      applyHeroVisualConfig(visualRoot, resolveHeroConfig(heroId));
    },
    dispose: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      gameplayRoot.dispose(false, true);
    }
  };
}
