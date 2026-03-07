// Responsável por construir e descartar a representação visual base de um jogador no mapa da partida.
import {
  AbstractMesh,
  AssetContainer,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Node,
  Scene,
  SceneLoader,
  Skeleton,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { DEFAULT_CHAMPION_ID, getBaseChampionById, isChampionId } from "../../data/champions.catalog";
import type { MatchPlayerState } from "../../models/match-player.model";

const TARGET_PLAYER_HEIGHT = 2.4;
const CAMERA_TARGET_OFFSET_Y = 1.28;
const heroModelContainerCache = new WeakMap<Scene, Map<string, Promise<AssetContainer>>>();

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

function normalizeAvatar(root: TransformNode): void {
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const height = Math.max(size.y, 0.001);
  const scaleFactor = TARGET_PLAYER_HEIGHT / height;

  root.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

  const scaledBounds = root.getHierarchyBoundingVectors(true);
  const center = scaledBounds.min.add(scaledBounds.max).scale(0.5);
  root.position = new Vector3(-center.x, -scaledBounds.min.y, -center.z);
}

function createPlayerLabel(
  scene: Scene,
  nickname: string,
  textColor: string,
  sessionId: string
): AbstractMesh {
  const texture = new DynamicTexture(
    `matchPlayerLabelTexture_${sessionId}`,
    { width: 512, height: 128 },
    scene,
    true
  );
  texture.hasAlpha = true;
  texture.drawText(
    nickname,
    null,
    88,
    "bold 56px Rajdhani",
    textColor,
    "transparent",
    true
  );

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
  plane.position = new Vector3(0, TARGET_PLAYER_HEIGHT + 0.52, 0);
  plane.isPickable = false;

  return plane;
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

export type MatchPlayerEntity = {
  sessionId: string;
  rootNode: TransformNode;
  characterNode: TransformNode;
  nameplateNode: AbstractMesh;
  setTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
  getTransform: () => { x: number; y: number; z: number; rotationY: number };
  getCameraTarget: () => Vector3;
  dispose: () => void;
};

export type CreateMatchPlayerEntityOptions = {
  scene: Scene;
  player: MatchPlayerState;
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
  forceFallbackOnly?: boolean;
};

export function createMatchPlayerEntity(options: CreateMatchPlayerEntityOptions): MatchPlayerEntity {
  const root = new TransformNode(`matchPlayerRoot_${options.player.sessionId}`, options.scene);
  const avatarRoot = new TransformNode(`matchPlayerAvatar_${options.player.sessionId}`, options.scene);
  avatarRoot.parent = root;

  const labelText = `${options.labelPrefix ?? ""}${options.player.nickname}`;
  const label = createPlayerLabel(
    options.scene,
    labelText,
    options.labelColorHex,
    options.player.sessionId
  );
  label.parent = root;

  const accentColor = Color3.FromHexString(options.accentColorHex);
  const fallbackMaterial = new StandardMaterial(`matchPlayerFallback_${options.player.sessionId}`, options.scene);
  fallbackMaterial.diffuseColor = accentColor;
  fallbackMaterial.emissiveColor = accentColor.scale(0.22);
  fallbackMaterial.specularColor = accentColor.scale(0.35);

  const fallbackBody = MeshBuilder.CreateCapsule(
    `matchPlayerFallbackBody_${options.player.sessionId}`,
    {
      height: TARGET_PLAYER_HEIGHT,
      radius: 0.44,
      tessellation: 18
    },
    options.scene
  );
  fallbackBody.material = fallbackMaterial;
  fallbackBody.parent = avatarRoot;

  const fallbackBase = MeshBuilder.CreateCylinder(
    `matchPlayerFallbackBase_${options.player.sessionId}`,
    {
      height: 0.12,
      diameter: 1.35,
      tessellation: 30
    },
    options.scene
  );
  fallbackBase.material = fallbackMaterial;
  fallbackBase.position.y = -TARGET_PLAYER_HEIGHT / 2 + 0.05;
  fallbackBase.parent = avatarRoot;

  normalizeAvatar(avatarRoot);

  let disposed = false;
  const importedSkeletons: Skeleton[] = [];
  const importedAnimationGroups: { dispose: () => void; stop: () => void }[] = [];

  const resolvedHeroId = isChampionId(options.player.heroId)
    ? options.player.heroId
    : DEFAULT_CHAMPION_ID;
  const heroModelUrl = getBaseChampionById(resolvedHeroId).modelUrl;

  if (heroModelUrl && options.forceFallbackOnly !== true) {
    void loadHeroModelContainer(options.scene, heroModelUrl)
      .then((modelContainer) => {
        if (disposed) {
          return;
        }

        const instantiated = modelContainer.instantiateModelsToScene(
          (sourceName) => `${sourceName}_${options.player.sessionId}`,
          true
        );

        importedSkeletons.push(...instantiated.skeletons);
        instantiated.animationGroups.forEach((group) => {
          group.stop();
        });
        importedAnimationGroups.push(...instantiated.animationGroups);

        const instantiatedRoots = collectInstantiatedRootNodes(instantiated.rootNodes);
        if (instantiatedRoots.length === 0) {
          instantiated.rootNodes.forEach((rootNode) => {
            rootNode.dispose(false, true);
          });
          instantiated.animationGroups.forEach((group) => {
            group.dispose();
          });
          instantiated.skeletons.forEach((skeleton) => {
            skeleton.dispose();
          });
          return;
        }

        instantiatedRoots.forEach((rootNode) => {
          rootNode.setParent(avatarRoot);
        });

        fallbackBody.dispose();
        fallbackBase.dispose();
        normalizeAvatar(avatarRoot);
      })
      .catch(() => {
        // Mantém o placeholder quando o modelo remoto falhar.
      });
  }

  root.position = new Vector3(options.player.x, options.player.y, options.player.z);
  root.rotation.y = options.player.rotationY;

  return {
    sessionId: options.player.sessionId,
    rootNode: root,
    characterNode: avatarRoot,
    nameplateNode: label,
    setTransform: (transform) => {
      root.position.set(transform.x, transform.y, transform.z);
      root.rotation.y = transform.rotationY;
    },
    getTransform: () => {
      return {
        x: root.position.x,
        y: root.position.y,
        z: root.position.z,
        rotationY: root.rotation.y
      };
    },
    getCameraTarget: () => {
      return new Vector3(root.position.x, root.position.y + CAMERA_TARGET_OFFSET_Y, root.position.z);
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;

      importedSkeletons.forEach((skeleton) => {
        skeleton.dispose();
      });
      importedAnimationGroups.forEach((group) => {
        group.stop();
        group.dispose();
      });

      root.dispose(false, true);
    }
  };
}
