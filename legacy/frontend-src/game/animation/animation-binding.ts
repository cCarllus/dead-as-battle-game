// Responsável por carregar arquivos de animação externos, retargetear por nome e gerar AnimationGroups vinculados ao rig do herói.
import {
  AnimationGroup,
  Scene,
  SceneLoader,
  TransformNode,
  type AssetContainer,
  type AbstractMesh,
  type Node,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import type { AnimationCommand } from "./animation-command";
import type { AnimationAssetDefinition } from "./animation-types";
import {
  filterPositionTrackForAxes,
  isPositionTrackProperty,
  logTrackContainment,
  resolveBoneContainmentAxes,
  resolveContainmentProfile,
  resolveAnimationContainmentMode,
} from "./animation-motion-containment";

const animationAssetContainerCache = new WeakMap<Scene, Map<string, Promise<AssetContainer | null>>>();
const warnedMissingAssetUrls = new Set<string>();
const warnedMissingSourceGroups = new Set<string>();
const warnedIncompatibleBindings = new Set<string>();

export type AnimationBindingTargetResolver = {
  bindingId: string;
  resolveTarget: (sourceTarget: unknown) => unknown | null;
};

export type CreateAnimationBindingTargetResolverOptions = {
  rootNodes: TransformNode[];
  sessionId: string;
  loadVersion: number;
};

export type LoadBoundAnimationCommandFromAssetOptions = {
  scene: Scene;
  command: AnimationCommand;
  assetDefinition: AnimationAssetDefinition;
  baseUrl: string;
  binding: AnimationBindingTargetResolver;
  loggerPrefix?: string;
  sourceLabel: "shared" | "override";
};

function normalizeNameForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function splitAssetPath(assetUrl: string): { rootUrl: string; fileName: string } {
  const lastSlash = assetUrl.lastIndexOf("/");
  if (lastSlash < 0) {
    return {
      rootUrl: "/",
      fileName: assetUrl
    };
  }

  return {
    rootUrl: assetUrl.slice(0, lastSlash + 1),
    fileName: assetUrl.slice(lastSlash + 1)
  };
}

function joinAssetUrl(baseUrl: string, fileName: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedFile = fileName.startsWith("/") ? fileName.slice(1) : fileName;
  return `${normalizedBase}/${normalizedFile}`;
}

function stripRuntimeSuffix(name: string, sessionId: string, loadVersion: number): string {
  const suffix = `_${sessionId}_${loadVersion}`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

function resolveSceneContainerCache(scene: Scene): Map<string, Promise<AssetContainer | null>> {
  const existingCache = animationAssetContainerCache.get(scene);
  if (existingCache) {
    return existingCache;
  }

  const nextCache = new Map<string, Promise<AssetContainer | null>>();
  animationAssetContainerCache.set(scene, nextCache);
  return nextCache;
}

async function loadAnimationAssetContainer(
  scene: Scene,
  assetUrl: string,
  loggerPrefix?: string
): Promise<AssetContainer | null> {
  const sceneCache = resolveSceneContainerCache(scene);
  const cachedContainer = sceneCache.get(assetUrl);
  if (cachedContainer) {
    return cachedContainer;
  }

  const { rootUrl, fileName } = splitAssetPath(assetUrl);
  const nextContainerPromise = SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene).catch((error) => {
    sceneCache.set(assetUrl, Promise.resolve(null));
    if (!warnedMissingAssetUrls.has(assetUrl)) {
      warnedMissingAssetUrls.add(assetUrl);
      const prefix = loggerPrefix ? `${loggerPrefix} ` : "";
      console.warn(`${prefix}Animation asset '${assetUrl}' could not be loaded.`, error);
    }
    return null;
  });

  sceneCache.set(assetUrl, nextContainerPromise);
  return nextContainerPromise;
}

function getNamedTargetName(target: unknown): string | null {
  const namedTarget = target as { name?: unknown } | null | undefined;
  return typeof namedTarget?.name === "string" && namedTarget.name.length > 0 ? namedTarget.name : null;
}

function registerNamedTarget(targetMap: Map<string, unknown>, name: string, target: unknown): void {
  const normalizedName = normalizeNameForMatch(name);
  if (!targetMap.has(normalizedName)) {
    targetMap.set(normalizedName, target);
  }
}

function collectMeshSkeletonTargets(rootNodes: TransformNode[]): AbstractMesh[] {
  return rootNodes.flatMap((rootNode) => rootNode.getChildMeshes(false));
}

function resolveAssetDefinition(
  assetDefinition: AnimationAssetDefinition
): { fileName: string; groupName?: string; stripPositionTracks: boolean; disableContainment: boolean } {
  return typeof assetDefinition === "string"
    ? { fileName: assetDefinition, stripPositionTracks: false, disableContainment: false }
    : {
        fileName: assetDefinition.fileName,
        groupName: assetDefinition.groupName,
        stripPositionTracks: assetDefinition.stripPositionTracks === true,
        disableContainment: assetDefinition.disableContainment === true
      };
}

function resolveSourceAnimationGroup(
  container: AssetContainer,
  command: AnimationCommand,
  assetDefinition: AnimationAssetDefinition,
  assetUrl: string,
  loggerPrefix?: string
): AnimationGroup | null {
  if (container.animationGroups.length === 0) {
    return null;
  }

  const resolvedAssetDefinition = resolveAssetDefinition(assetDefinition);
  const expectedGroupName =
    resolvedAssetDefinition.groupName ??
    resolvedAssetDefinition.fileName.replace(/\.[^/.]+$/, "");
  const normalizedExpectedGroupName = normalizeNameForMatch(expectedGroupName);

  const directMatch = container.animationGroups.find((group) => {
    return normalizeNameForMatch(group.name) === normalizedExpectedGroupName;
  });
  if (directMatch) {
    return directMatch;
  }

  const partialMatch = container.animationGroups.find((group) => {
    return normalizeNameForMatch(group.name).includes(normalizedExpectedGroupName);
  });
  if (partialMatch) {
    return partialMatch;
  }

  if (container.animationGroups.length === 1) {
    return container.animationGroups[0] ?? null;
  }

  const warningKey = `${assetUrl}:${command}`;
  if (!warnedMissingSourceGroups.has(warningKey)) {
    warnedMissingSourceGroups.add(warningKey);
    const prefix = loggerPrefix ? `${loggerPrefix} ` : "";
    console.warn(
      `${prefix}Animation asset '${assetUrl}' has multiple groups and none matched '${expectedGroupName}'.`
    );
  }

  return container.animationGroups[0] ?? null;
}

function resolveBlockedPositionTargetNames(container: AssetContainer): Set<string> {
  const blockedTargetNames = new Set<string>();
  container.rootNodes.forEach((rootNode) => {
    const rootNodeName = getNamedTargetName(rootNode);
    if (rootNodeName) {
      blockedTargetNames.add(normalizeNameForMatch(rootNodeName));
    }

    if (!(rootNode instanceof TransformNode)) {
      return;
    }

    rootNode.getDescendants(false).forEach((descendant) => {
      const descendantName = getNamedTargetName(descendant);
      if (!descendantName) {
        return;
      }

      blockedTargetNames.add(normalizeNameForMatch(descendantName));
    });
  });
  return blockedTargetNames;
}

export function createAnimationBindingTargetResolver(
  options: CreateAnimationBindingTargetResolverOptions
): AnimationBindingTargetResolver {
  const targetMap = new Map<string, unknown>();

  options.rootNodes.forEach((rootNode) => {
    registerNamedTarget(targetMap, rootNode.name, rootNode);
    registerNamedTarget(targetMap, stripRuntimeSuffix(rootNode.name, options.sessionId, options.loadVersion), rootNode);

    rootNode.getDescendants(false).forEach((descendant) => {
      const descendantName = getNamedTargetName(descendant);
      if (!descendantName) {
        return;
      }

      registerNamedTarget(targetMap, descendantName, descendant);
      registerNamedTarget(
        targetMap,
        stripRuntimeSuffix(descendantName, options.sessionId, options.loadVersion),
        descendant
      );
    });
  });

  collectMeshSkeletonTargets(options.rootNodes).forEach((mesh) => {
    registerNamedTarget(targetMap, mesh.name, mesh);
    registerNamedTarget(targetMap, stripRuntimeSuffix(mesh.name, options.sessionId, options.loadVersion), mesh);

    const skeleton = mesh.skeleton;
    if (!skeleton) {
      return;
    }

    registerNamedTarget(targetMap, skeleton.name, skeleton);
    skeleton.bones.forEach((bone) => {
      registerNamedTarget(targetMap, bone.name, bone);
    });
  });

  return {
    bindingId: `${options.sessionId}_${options.loadVersion}`,
    resolveTarget: (sourceTarget) => {
      const sourceTargetName = getNamedTargetName(sourceTarget);
      if (!sourceTargetName) {
        return null;
      }

      return targetMap.get(normalizeNameForMatch(sourceTargetName)) ?? null;
    }
  };
}

export async function loadBoundAnimationCommandFromAsset(
  options: LoadBoundAnimationCommandFromAssetOptions
): Promise<AnimationGroup | null> {
  const resolvedAssetDefinition = resolveAssetDefinition(options.assetDefinition);
  const assetUrl = joinAssetUrl(options.baseUrl, resolvedAssetDefinition.fileName);
  const container = await loadAnimationAssetContainer(options.scene, assetUrl, options.loggerPrefix);
  if (!container) {
    return null;
  }

  const sourceGroup = resolveSourceAnimationGroup(
    container,
    options.command,
    options.assetDefinition,
    assetUrl,
    options.loggerPrefix
  );
  if (!sourceGroup) {
    return null;
  }

  const blockedPositionTargetNames = resolveBlockedPositionTargetNames(container);
  const containmentResolve = resolvedAssetDefinition.disableContainment
    ? {
        mode: resolveAnimationContainmentMode(),
        profile: null,
        source: "none" as const
      }
    : resolveContainmentProfile({
        command: options.command,
        locomotionState: undefined,
        mode: resolveAnimationContainmentMode()
      });
  const boundGroup = new AnimationGroup(
    `${options.sourceLabel}_${options.command}_${options.binding.bindingId}`,
    options.scene
  );
  let boundAnimationCount = 0;
  let skippedTargetCount = 0;

  sourceGroup.targetedAnimations.forEach((targetedAnimation) => {
    const resolvedTarget = options.binding.resolveTarget(targetedAnimation.target);
    if (!resolvedTarget) {
      skippedTargetCount += 1;
      return;
    }

    const sourceTargetName = getNamedTargetName(targetedAnimation.target);
    const targetProperty = targetedAnimation.animation.targetProperty;
    const shouldStripPositionTrack =
      typeof targetProperty === "string" &&
      isPositionTrackProperty(targetProperty) &&
      (resolvedAssetDefinition.stripPositionTracks === true ||
        (sourceTargetName !== null &&
          blockedPositionTargetNames.has(normalizeNameForMatch(sourceTargetName))));
    if (
      shouldStripPositionTrack
    ) {
      skippedTargetCount += 1;
      return;
    }

    const clonedAnimation = targetedAnimation.animation.clone(true);
    let filteredAnimation = clonedAnimation;
    if (
      containmentResolve.profile &&
      typeof sourceTargetName === "string" &&
      typeof targetProperty === "string" &&
      isPositionTrackProperty(targetProperty)
    ) {
      const blockedAxes = resolveBoneContainmentAxes(containmentResolve.profile, sourceTargetName);
      if (blockedAxes && (blockedAxes.x || blockedAxes.y || blockedAxes.z)) {
        const trackFilterResult = filterPositionTrackForAxes({
          animation: clonedAnimation,
          targetProperty,
          blockedAxes
        });

        if (trackFilterResult.suppressTrack || !trackFilterResult.filteredAnimation) {
          const logKey = [
            options.binding.bindingId,
            options.command,
            sourceTargetName,
            targetProperty,
            containmentResolve.source,
            "suppress"
          ].join(":");
          logTrackContainment({
            key: logKey,
            command: options.command,
            clipLabel: resolvedAssetDefinition.fileName,
            targetName: sourceTargetName,
            targetProperty,
            blockedAxes,
            action: "suppress",
            source: containmentResolve.source,
            loggerPrefix: options.loggerPrefix
          });
          skippedTargetCount += 1;
          return;
        }

        filteredAnimation = trackFilterResult.filteredAnimation;
        const logKey = [
          options.binding.bindingId,
          options.command,
          sourceTargetName,
          targetProperty,
          containmentResolve.source,
          "axis-filter"
        ].join(":");
        logTrackContainment({
          key: logKey,
          command: options.command,
          clipLabel: resolvedAssetDefinition.fileName,
          targetName: sourceTargetName,
          targetProperty,
          blockedAxes,
          action: "axis-filter",
          source: containmentResolve.source,
          loggerPrefix: options.loggerPrefix
        });
      }
    }

    boundGroup.addTargetedAnimation(filteredAnimation, resolvedTarget);
    boundAnimationCount += 1;
  });

  if (boundAnimationCount <= 0) {
    boundGroup.dispose();
    const warningKey = `${options.binding.bindingId}:${assetUrl}:${options.command}`;
    if (!warnedIncompatibleBindings.has(warningKey)) {
      warnedIncompatibleBindings.add(warningKey);
      const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
      console.warn(
        `${prefix}Animation asset '${assetUrl}' is incompatible with the hero rig for command '${options.command}'.`
      );
    }
    return null;
  }

  boundGroup.from = sourceGroup.from;
  boundGroup.to = sourceGroup.to;
  boundGroup.speedRatio = sourceGroup.speedRatio;
  boundGroup.loopAnimation = sourceGroup.loopAnimation;
  boundGroup.isAdditive = sourceGroup.isAdditive;
  boundGroup.stop();
  boundGroup.reset();
  boundGroup.metadata = {
    sourceLabel: options.sourceLabel,
    command: options.command,
    assetUrl,
    skippedTargetCount
  };

  return boundGroup;
}
