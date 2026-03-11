// Responsável por carregar visual do herói e compor o bundle final de animações via shared library, overrides e fallback embutido.
import {
  type AnimationGroup,
  AssetContainer,
  Node,
  Scene,
  SceneLoader,
  TransformNode
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { createAnimationBindingTargetResolver } from "./animation-binding";
import { loadHeroAnimationOverrides } from "./hero-animation-overrides";
import { loadSharedAnimationLibrary } from "./shared-animation-library";
import type { AnimationCommandGroupMap, HeroAnimationConfig } from "./animation-types";

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

function stopAndResetGroups(animationGroups: readonly AnimationGroup[]): void {
  animationGroups.forEach((group) => {
    group.stop();
    group.reset();
  });
}

function disposeBoundGroups(groupMap: AnimationCommandGroupMap): void {
  Object.values(groupMap).forEach((group) => {
    group?.stop();
    group?.dispose();
  });
}

export type HeroVisualLoadResult = {
  rootNodes: TransformNode[];
  embeddedAnimationGroups: AnimationGroup[];
  sharedAnimationGroupsByCommand: AnimationCommandGroupMap;
  overrideAnimationGroupsByCommand: AnimationCommandGroupMap;
  dispose: () => void;
};

export type LoadHeroVisualOptions = {
  scene: Scene;
  visualRoot: TransformNode;
  modelUrl: string;
  heroId: string;
  sessionId: string;
  loadVersion: number;
  animationConfig: HeroAnimationConfig;
  animationOverrideBaseUrl: string | null;
};

export async function loadHeroVisualAssets(options: LoadHeroVisualOptions): Promise<HeroVisualLoadResult> {
  const loggerPrefix = `[animation][hero:${options.heroId}][player:${options.sessionId}]`;
  const modelContainer = await loadHeroModelContainer(options.scene, options.modelUrl);

  const instantiated = modelContainer.instantiateModelsToScene(
    (sourceName) => `${sourceName}_${options.sessionId}_${options.loadVersion}`,
    true,
    { doNotInstantiate: true }
  );

  const skinRootNodes = collectInstantiatedRootNodes(instantiated.rootNodes);
  if (skinRootNodes.length === 0) {
    instantiated.dispose();
    throw new Error(`${loggerPrefix} Loaded visual model has no root nodes.`);
  }

  skinRootNodes.forEach((rootNode) => {
    rootNode.parent = options.visualRoot;

    options.scene.stopAnimation(rootNode);
    rootNode.getDescendants(false).forEach((descendant) => {
      options.scene.stopAnimation(descendant);
    });

    rootNode.getChildMeshes(false).forEach((mesh) => {
      mesh.isPickable = false;
    });
  });

  const embeddedAnimationGroups = instantiated.animationGroups.slice();
  stripRootMotionFromAnimationGroups(embeddedAnimationGroups, skinRootNodes);
  stopAndResetGroups(embeddedAnimationGroups);

  const binding = createAnimationBindingTargetResolver({
    rootNodes: skinRootNodes,
    sessionId: options.sessionId,
    loadVersion: options.loadVersion
  });

  const [sharedAnimationGroupsByCommand, overrideAnimationGroupsByCommand] = await Promise.all([
    loadSharedAnimationLibrary({
      scene: options.scene,
      binding,
      loggerPrefix
    }),
    loadHeroAnimationOverrides({
      scene: options.scene,
      heroId: options.heroId,
      animationConfig: options.animationConfig,
      animationOverrideBaseUrl: options.animationOverrideBaseUrl,
      binding,
      loggerPrefix
    })
  ]);

  if (embeddedAnimationGroups.length > 0) {
    console.warn(
      `${loggerPrefix} Using embedded AnimationGroups only as migration fallback. Shared/override assets should become the primary source.`
    );
  }

  return {
    rootNodes: skinRootNodes,
    embeddedAnimationGroups,
    sharedAnimationGroupsByCommand,
    overrideAnimationGroupsByCommand,
    dispose: () => {
      disposeBoundGroups(sharedAnimationGroupsByCommand);
      disposeBoundGroups(overrideAnimationGroupsByCommand);
      instantiated.dispose();
    }
  };
}
