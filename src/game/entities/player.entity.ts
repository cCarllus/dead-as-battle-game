// Responsável por construir um player desacoplado em duas camadas: gameplay autoritativo e visual.
import {
  AbstractMesh,
  AssetContainer,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Node,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import {
  getHeroRuntimeCalibration,
  setHeroRuntimeCalibration
} from "../config/hero-calibration.store";
import { resolveHeroConfig, type HeroConfig } from "../config/hero-config";
import type { MatchPlayerState } from "../../models/match-player.model";

const PLAYER_COLLISION_HEIGHT = 2.4;
const PLAYER_COLLISION_RADIUS = 0.44;
const CAMERA_TARGET_OFFSET_Y = 1.28;
const NAMEPLATE_OFFSET_Y = PLAYER_COLLISION_HEIGHT + 0.52;
const TARGET_VISUAL_HEIGHT = PLAYER_COLLISION_HEIGHT;
const heroModelContainerCache = new WeakMap<Scene, Map<string, Promise<AssetContainer>>>();

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

type HeroSkinHandle = {
  animationGroups: {
    stop: () => void;
  }[];
  dispose: () => void;
};

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

function resolveSceneContainerCache(scene: Scene): Map<string, Promise<AssetContainer>> {
  const existingCache = heroModelContainerCache.get(scene);
  if (existingCache) {
    return existingCache;
  }

  const nextCache = new Map<string, Promise<AssetContainer>>();
  heroModelContainerCache.set(scene, nextCache);
  return nextCache;
}

async function loadHeroModelContainer(scene: Scene, modelUrl: string): Promise<AssetContainer> {
  const sceneCache = resolveSceneContainerCache(scene);
  const cachedContainerPromise = sceneCache.get(modelUrl);
  if (cachedContainerPromise) {
    return cachedContainerPromise;
  }

  const { rootUrl, fileName } = splitModelPath(modelUrl);
  const nextContainerPromise = SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene).catch((error) => {
    sceneCache.delete(modelUrl);
    throw error;
  });

  sceneCache.set(modelUrl, nextContainerPromise);
  return nextContainerPromise;
}

function collectInstantiatedRootNodes(rootNodes: readonly Node[]): TransformNode[] {
  const transformNodes = rootNodes.filter((node): node is TransformNode => node instanceof TransformNode);
  const rootIds = new Set<number>(transformNodes.map((node) => node.uniqueId));

  return transformNodes.filter((node) => {
    const parentNode = node.parent as TransformNode | null;
    if (!parentNode) {
      return true;
    }

    return !rootIds.has(parentNode.uniqueId);
  });
}

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

function applyHeroVisualConfig(
  visualRoot: TransformNode,
  heroConfig: HeroConfig,
  calibration?: {
    normalizedScale: number;
    normalizedOffsetY: number;
  } | null
): void {
  const safeScale =
    Number.isFinite(heroConfig.visualScale) && heroConfig.visualScale > 0
      ? heroConfig.visualScale
      : 1;
  const normalizedScale =
    calibration && Number.isFinite(calibration.normalizedScale) && calibration.normalizedScale > 0
      ? calibration.normalizedScale
      : 1;
  const normalizedOffsetY =
    calibration && Number.isFinite(calibration.normalizedOffsetY)
      ? calibration.normalizedOffsetY
      : 0;
  const finalScale = safeScale * normalizedScale;

  visualRoot.position.set(
    heroConfig.visualOffset.x,
    heroConfig.visualOffset.y + normalizedOffsetY,
    heroConfig.visualOffset.z
  );
  visualRoot.rotation.set(0, heroConfig.visualYaw, 0);
  visualRoot.scaling.set(finalScale, finalScale, finalScale);
}

function resetSkinRootTransform(rootNode: TransformNode): void {
  rootNode.position.setAll(0);
  rootNode.rotation.setAll(0);
  if (rootNode.rotationQuaternion) {
    rootNode.rotationQuaternion = Quaternion.Identity();
  }
  rootNode.scaling.setAll(1);
}

function calculateNormalizedCalibration(
  skinRootNodes: TransformNode[]
): { normalizedScale: number; normalizedOffsetY: number } | null {
  if (skinRootNodes.length === 0) {
    return null;
  }

  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  skinRootNodes.forEach((rootNode) => {
    const bounds = rootNode.getHierarchyBoundingVectors(true);
    min.x = Math.min(min.x, bounds.min.x);
    min.y = Math.min(min.y, bounds.min.y);
    min.z = Math.min(min.z, bounds.min.z);
    max.x = Math.max(max.x, bounds.max.x);
    max.y = Math.max(max.y, bounds.max.y);
    max.z = Math.max(max.z, bounds.max.z);
  });

  const height = max.y - min.y;
  if (!Number.isFinite(height) || height <= 0.000001) {
    return null;
  }

  const normalizedScale = TARGET_VISUAL_HEIGHT / height;
  if (!Number.isFinite(normalizedScale) || normalizedScale <= 0) {
    return null;
  }

  return {
    normalizedScale,
    normalizedOffsetY: -min.y * normalizedScale
  };
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
  collisionBody.isVisible = true;

  const label = createPlayerLabel(options.scene, options.player.sessionId);
  label.mesh.parent = gameplayRoot;

  let isDisposed = false;
  let skinLoadVersion = 0;
  let skinHandle: HeroSkinHandle | null = null;
  let style: PlayerVisualStyle = {
    accentColorHex: options.accentColorHex,
    labelColorHex: options.labelColorHex,
    labelPrefix: options.labelPrefix
  };
  let nickname = options.player.nickname;

  const disposeSkinHandle = (): void => {
    if (!skinHandle) {
      return;
    }

    skinHandle.animationGroups.forEach((group) => {
      group.stop();
    });
    skinHandle.dispose();
    skinHandle = null;
  };

  const applyDisplay = (): void => {
    const accentColor = Color3.FromHexString(style.accentColorHex);
    collisionMaterial.diffuseColor = accentColor;
    collisionMaterial.emissiveColor = accentColor.scale(0.22);
    collisionMaterial.specularColor = accentColor.scale(0.35);

    label.setText(`${style.labelPrefix ?? ""}${nickname}`, style.labelColorHex);
  };

  const applyHeroSkin = (heroConfig: HeroConfig): void => {
    const cachedCalibration = getHeroRuntimeCalibration(heroConfig.id);
    applyHeroVisualConfig(visualRoot, heroConfig, cachedCalibration);
    skinLoadVersion += 1;
    const currentLoadVersion = skinLoadVersion;
    disposeSkinHandle();
    collisionBody.isVisible = true;

    if (!heroConfig.modelUrl) {
      return;
    }

    void loadHeroModelContainer(options.scene, heroConfig.modelUrl)
      .then((container) => {
        if (isDisposed || currentLoadVersion !== skinLoadVersion) {
          return;
        }

        const instantiated = container.instantiateModelsToScene(
          (sourceName) => `${sourceName}_${options.player.sessionId}_${currentLoadVersion}`,
          true,
          { doNotInstantiate: true }
        );

        instantiated.animationGroups.forEach((group) => {
          group.stop();
          group.reset();
        });

        const skinRootNodes = collectInstantiatedRootNodes(instantiated.rootNodes);
        if (skinRootNodes.length === 0) {
          instantiated.dispose();
          return;
        }

        skinRootNodes.forEach((rootNode) => {
          rootNode.setParent(visualRoot);
          resetSkinRootTransform(rootNode);

          options.scene.stopAnimation(rootNode);
          rootNode.getDescendants(false).forEach((descendant) => {
            options.scene.stopAnimation(descendant);
          });

          rootNode.getChildMeshes(false).forEach((mesh) => {
            mesh.isPickable = false;
          });
        });

        const runtimeCalibration =
          cachedCalibration ?? calculateNormalizedCalibration(skinRootNodes);
        if (runtimeCalibration && !cachedCalibration) {
          setHeroRuntimeCalibration(heroConfig.id, runtimeCalibration);
        }
        applyHeroVisualConfig(visualRoot, heroConfig, runtimeCalibration ?? cachedCalibration);

        if (isDisposed || currentLoadVersion !== skinLoadVersion) {
          instantiated.dispose();
          return;
        }

        collisionBody.isVisible = false;
        skinHandle = {
          animationGroups: instantiated.animationGroups,
          dispose: () => {
            instantiated.dispose();
          }
        };
      })
      .catch(() => {
        // Em caso de falha do asset, mantém apenas collisionBody e nameplate.
      });
  };

  applyDisplay();
  applyHeroSkin(resolveHeroConfig(options.player.heroId));

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
      applyHeroSkin(resolveHeroConfig(heroId));
    },
    dispose: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      skinLoadVersion += 1;
      disposeSkinHandle();
      gameplayRoot.dispose(false, true);
    }
  };
}
