// Responsável por carregar o modelo GLB do herói e expor seus AnimationGroups embutidos.
import {
  type AnimationGroup,
  AssetContainer,
  Node,
  Scene,
  SceneLoader,
  TransformNode
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

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

function isPositionAnimationTargetProperty(targetProperty: string): boolean {
  const normalized = targetProperty.trim().toLowerCase();
  return normalized === "position" || normalized.startsWith("position.");
}

function stripRootMotionFromAnimationGroups(
  animationGroups: readonly AnimationGroup[],
  skinRootNodes: readonly TransformNode[]
): void {
  const blockedTargetIds = new Set<number>();
  skinRootNodes.forEach((rootNode) => {
    blockedTargetIds.add(rootNode.uniqueId);
  });

  animationGroups.forEach((group) => {
    const filtered = group.targetedAnimations.filter((targetedAnimation) => {
      const targetUniqueId = (targetedAnimation.target as { uniqueId?: unknown } | undefined)?.uniqueId;
      if (typeof targetUniqueId !== "number" || !blockedTargetIds.has(targetUniqueId)) {
        return true;
      }

      const targetProperty = targetedAnimation.animation?.targetProperty;
      if (typeof targetProperty !== "string") {
        return true;
      }

      return !isPositionAnimationTargetProperty(targetProperty);
    });
    group.targetedAnimations.splice(0, group.targetedAnimations.length, ...filtered);
  });
}

export type HeroVisualLoadResult = {
  rootNodes: TransformNode[];
  animationGroups: AnimationGroup[];
  dispose: () => void;
};

export type LoadHeroVisualOptions = {
  scene: Scene;
  visualRoot: TransformNode;
  modelUrl: string;
  heroId: string;
  sessionId: string;
  loadVersion: number;
};

export async function loadHeroVisualAssets(options: LoadHeroVisualOptions): Promise<HeroVisualLoadResult> {
  const modelContainer = await loadHeroModelContainer(options.scene, options.modelUrl);

  const instantiated = modelContainer.instantiateModelsToScene(
    (sourceName) => `${sourceName}_${options.sessionId}_${options.loadVersion}`,
    true,
    { doNotInstantiate: true }
  );

  const skinRootNodes = collectInstantiatedRootNodes(instantiated.rootNodes);
  if (skinRootNodes.length === 0) {
    instantiated.dispose();
    throw new Error(
      `[animation][hero:${options.heroId}][player:${options.sessionId}] Loaded model has no root nodes.`
    );
  }

  skinRootNodes.forEach((rootNode) => {
    // Mantém transform de import (incluindo conversão glTF -> Babylon) e
    // aplica apenas o parent visual para herdar yaw/scale do herói.
    rootNode.parent = options.visualRoot;

    options.scene.stopAnimation(rootNode);
    rootNode.getDescendants(false).forEach((descendant) => {
      options.scene.stopAnimation(descendant);
    });

    rootNode.getChildMeshes(false).forEach((mesh) => {
      mesh.isPickable = false;
    });
  });

  const animationGroups = instantiated.animationGroups.slice();
  // Remove root motion positional tracks so movement stays authoritative on gameplayRoot.
  stripRootMotionFromAnimationGroups(animationGroups, skinRootNodes);
  animationGroups.forEach((group) => {
    group.stop();
    group.reset();
  });

  if (animationGroups.length === 0) {
    console.warn(
      `[animation][hero:${options.heroId}][player:${options.sessionId}] No animation groups found in '${options.modelUrl}'.`
    );
  }

  return {
    rootNodes: skinRootNodes,
    animationGroups,
    dispose: () => {
      instantiated.dispose();
    }
  };
}
