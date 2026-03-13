// Responsável por reproduzir AnimationGroups com prioridade override -> shared -> embedded fallback.
import { Vector3, type AnimationGroup } from "@babylonjs/core";
import {
  LOOPED_ANIMATION_COMMANDS,
  type AnimationCommand
} from "./animation-command";
import {
  type AnimationGameplayState,
  resolveAnimationCommandFromGameplay
} from "./animation-state";
import type { AnimationCommandGroupMap, HeroAnimationConfig } from "./animation-types";
import {
  applyAxisLockToTargetPosition,
  logRuntimeContainment,
  resolveBoneContainmentAxes,
  resolveContainmentProfile,
  resolvePositionFromTarget
} from "./animation-motion-containment";

export type CreateAnimationControllerOptions = {
  overrideAnimationGroupsByCommand: AnimationCommandGroupMap;
  sharedAnimationGroupsByCommand: AnimationCommandGroupMap;
  embeddedAnimationGroups: AnimationGroup[];
  animationConfig: HeroAnimationConfig;
  loggerPrefix?: string;
  blendingDurationSeconds?: number;
};

export type AnimationController = {
  play: (command: AnimationCommand) => void;
  syncFromGameplay: (gameplayState: AnimationGameplayState) => void;
  stop: () => void;
  getCurrentCommand: () => AnimationCommand | null;
  dispose: () => void;
};

type AnimationSource = "override" | "shared" | "embedded";

function normalizeNameForMatch(groupName: string): string {
  return groupName.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function shouldLoopCommand(command: AnimationCommand, animationConfig: HeroAnimationConfig): boolean {
  const loopedCommands = animationConfig.loopedCommands ?? LOOPED_ANIMATION_COMMANDS;
  return loopedCommands.some((loopedCommand) => loopedCommand === command);
}

const DEFAULT_BLENDING_DURATION_SECONDS = 0.18;
const NON_RESTARTABLE_SAME_COMMANDS: readonly AnimationCommand[] = [
  "ultimate",
  "inAir",
  "death"
] as const;
const DIRECT_SOURCE_PRIORITY: readonly AnimationSource[] = ["override", "shared"] as const;
const JUMP_START_TRIM_RATIO = 0.35;

function resolvePlaybackSpeedRatio(command: AnimationCommand): number {
  switch (command) {
    case "attack1":
    case "attack2":
    case "attack3":
      return 2.0;
    default:
      return 1;
  }
}

function startGroupForCommand(
  group: AnimationGroup,
  command: AnimationCommand,
  shouldLoop: boolean
): void {
  const speedRatio = resolvePlaybackSpeedRatio(command);

  if (command !== "jump" && command !== "doubleJump") {
    group.start(shouldLoop, speedRatio);
    return;
  }

  const fromFrame = group.from;
  const toFrame = group.to;
  if (!Number.isFinite(fromFrame) || !Number.isFinite(toFrame) || toFrame <= fromFrame) {
    group.start(shouldLoop, speedRatio);
    return;
  }

  const trimmedFromFrame = fromFrame + (toFrame - fromFrame) * JUMP_START_TRIM_RATIO;
  group.start(shouldLoop, speedRatio, trimmedFromFrame, toFrame, false);
}

function resolveCommandPriority(command: AnimationCommand): number {
  switch (command) {
    case "death":
      return 8;
    case "ultimate":
      return 7;
    case "attack1":
    case "attack2":
    case "attack3":
      return 6;
    case "hit":
      return 5;
    case "block":
      return 4;
    case "ledgeClimb":
      return 3.5;
    case "ledgeHang":
    case "jump":
    case "doubleJump":
    case "inAir":
      return 3;
    case "rolling":
    case "run":
      return 2;
    case "walk":
      return 1;
    case "idle":
    default:
      return 0;
  }
}

function resolveAliasCommands(command: AnimationCommand): AnimationCommand[] {
  switch (command) {
    case "death":
      return ["hit"];
    case "inAir":
      return ["inAir", "jump"];
    default:
      return [];
  }
}

export function createAnimationController(options: CreateAnimationControllerOptions): AnimationController {
  const warnedMissingMappings = new Set<AnimationCommand>();
  const warnedMissingGroups = new Set<string>();
  const warnedEmbeddedFallbackUsage = new Set<string>();

  const blendingDurationSeconds =
    typeof options.blendingDurationSeconds === "number" && options.blendingDurationSeconds >= 0
      ? options.blendingDurationSeconds
      : DEFAULT_BLENDING_DURATION_SECONDS;

  const normalizedEmbeddedGroups = options.embeddedAnimationGroups.map((group) => {
    group.stop();
    group.reset();
    group.enableBlending = blendingDurationSeconds > 0;
    group.blendingSpeed = blendingDurationSeconds > 0 ? 1 / Math.max(blendingDurationSeconds, 0.0001) : 0;

    return {
      group,
      normalizedName: normalizeNameForMatch(group.name)
    };
  });

  const applyBlendingConfig = (group: AnimationGroup): AnimationGroup => {
    group.enableBlending = blendingDurationSeconds > 0;
    group.blendingSpeed = blendingDurationSeconds > 0 ? 1 / Math.max(blendingDurationSeconds, 0.0001) : 0;
    return group;
  };

  const findEmbeddedGroupByMappedName = (mappedGroupName: string): AnimationGroup | null => {
    const normalizedMappedName = normalizeNameForMatch(mappedGroupName);
    const exactMatch = normalizedEmbeddedGroups.find(({ normalizedName }) => normalizedName === normalizedMappedName);
    if (exactMatch) {
      return exactMatch.group;
    }

    const partialMatch = normalizedEmbeddedGroups.find(({ normalizedName }) => normalizedName.includes(normalizedMappedName));
    return partialMatch?.group ?? null;
  };

  const resolveEmbeddedMappedName = (command: AnimationCommand): string | null => {
    const mappedGroupName = options.animationConfig.embeddedCommandToGroupName[command];
    if (mappedGroupName) {
      return mappedGroupName;
    }

    if (command === "death") {
      const hitFallback = options.animationConfig.embeddedCommandToGroupName.hit;
      if (hitFallback) {
        return hitFallback;
      }
    }

    if (command === "inAir" || command === "doubleJump") {
      const jumpFallback = options.animationConfig.embeddedCommandToGroupName.jump;
      if (jumpFallback) {
        return jumpFallback;
      }
    }

    if (!warnedMissingMappings.has(command)) {
      warnedMissingMappings.add(command);
      const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
      console.warn(`${prefix}Command '${command}' is not mapped for embedded fallback on hero '${options.animationConfig.heroId}'.`);
    }

    if (command !== "idle") {
      return options.animationConfig.embeddedCommandToGroupName.idle ?? null;
    }

    return null;
  };

  const resolveDirectSourceGroup = (
    command: AnimationCommand
  ): { playbackCommand: AnimationCommand; group: AnimationGroup; source: AnimationSource } | null => {
    const candidateCommands = [command, ...resolveAliasCommands(command)];

    for (const source of DIRECT_SOURCE_PRIORITY) {
      const groupMap =
        source === "override"
          ? options.overrideAnimationGroupsByCommand
          : options.sharedAnimationGroupsByCommand;

      for (const candidateCommand of candidateCommands) {
        const group = groupMap[candidateCommand];
        if (!group) {
          continue;
        }

        return {
          playbackCommand: candidateCommand,
          group: applyBlendingConfig(group),
          source
        };
      }
    }

    return null;
  };

  const resolveEmbeddedFallbackGroup = (
    command: AnimationCommand
  ): { playbackCommand: AnimationCommand; group: AnimationGroup; source: AnimationSource } | null => {
    if (!options.animationConfig.allowEmbeddedFallback) {
      return null;
    }

    const candidateCommands = [command, ...resolveAliasCommands(command)];
    for (const candidateCommand of candidateCommands) {
      const mappedName = resolveEmbeddedMappedName(candidateCommand);
      if (!mappedName) {
        continue;
      }

      const group = findEmbeddedGroupByMappedName(mappedName);
      if (!group) {
        const missingKey = `${candidateCommand}:${mappedName}`;
        if (!warnedMissingGroups.has(missingKey)) {
          warnedMissingGroups.add(missingKey);
          const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
          console.warn(
            `${prefix}Embedded fallback group '${mappedName}' for command '${candidateCommand}' was not found in hero GLB.`
          );
        }
        continue;
      }

      const fallbackKey = `${options.animationConfig.heroId}:${candidateCommand}`;
      if (!warnedEmbeddedFallbackUsage.has(fallbackKey)) {
        warnedEmbeddedFallbackUsage.add(fallbackKey);
        const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
        console.warn(`${prefix}Using embedded animation fallback for command '${candidateCommand}'.`);
      }

      return {
        playbackCommand: candidateCommand,
        group,
        source: "embedded"
      };
    }

    return null;
  };

  const resolvePlayableAnimation = (
    requestedCommand: AnimationCommand
  ): { playbackCommand: AnimationCommand; group: AnimationGroup; source: AnimationSource } | null => {
    const directPlayableAnimation = resolveDirectSourceGroup(requestedCommand);
    if (directPlayableAnimation) {
      return directPlayableAnimation;
    }

    const embeddedFallbackAnimation = resolveEmbeddedFallbackGroup(requestedCommand);
    if (embeddedFallbackAnimation) {
      return embeddedFallbackAnimation;
    }

    if (requestedCommand !== "idle") {
      return resolveDirectSourceGroup("idle") ?? resolveEmbeddedFallbackGroup("idle");
    }

    return null;
  };

  let currentRequestedCommand: AnimationCommand | null = null;
  let currentPlaybackCommand: AnimationCommand | null = null;
  let currentGroup: AnimationGroup | null = null;
  let currentGameplayState: AnimationGameplayState | null = null;
  let baselineByTarget = new WeakMap<object, Vector3>();
  let lastContainmentSignature = "";

  const applyRuntimeContainment = (): void => {
    if (!currentGroup) {
      return;
    }

    const containment = resolveContainmentProfile({
      command: currentPlaybackCommand,
      locomotionState: currentGameplayState?.locomotionState
    });
    if (!containment.profile) {
      return;
    }

    const containmentSignature = [
      containment.mode,
      containment.source,
      currentPlaybackCommand ?? "none",
      currentGameplayState?.locomotionState ?? "none",
      currentGroup.name
    ].join(":");
    if (lastContainmentSignature !== containmentSignature) {
      lastContainmentSignature = containmentSignature;
      baselineByTarget = new WeakMap<object, Vector3>();
    }

    const processedTargets = new Set<object>();
    const filteredTargetNames = new Set<string>();
    let maxVerticalDrift = 0;
    let maxHorizontalDrift = 0;

    currentGroup.targetedAnimations.forEach((targetedAnimation) => {
      const target = targetedAnimation.target as object | null | undefined;
      if (!target || processedTargets.has(target)) {
        return;
      }
      processedTargets.add(target);

      const targetName = (targetedAnimation.target as { name?: unknown } | undefined)?.name;
      const normalizedName = typeof targetName === "string" ? targetName : "<unnamed>";
      const blockedAxes = resolveBoneContainmentAxes(containment.profile, normalizedName);
      if (!blockedAxes || (!blockedAxes.x && !blockedAxes.y && !blockedAxes.z)) {
        return;
      }

      const currentPosition = resolvePositionFromTarget(target);
      if (!currentPosition) {
        return;
      }

      const baseline = baselineByTarget.get(target) ?? currentPosition.clone();
      baselineByTarget.set(target, baseline);

      const drift = currentPosition.subtract(baseline);
      const horizontalDrift = Math.hypot(drift.x, drift.z);
      maxVerticalDrift = Math.max(maxVerticalDrift, Math.abs(drift.y));
      maxHorizontalDrift = Math.max(maxHorizontalDrift, horizontalDrift);

      const didApply = applyAxisLockToTargetPosition(target, baseline, blockedAxes);
      if (didApply) {
        const axisLabel = `${blockedAxes.x ? "X" : ""}${blockedAxes.y ? "Y" : ""}${blockedAxes.z ? "Z" : ""}`;
        filteredTargetNames.add(`${normalizedName}:${axisLabel || "none"}`);
      }
    });

    if (filteredTargetNames.size > 0) {
      logRuntimeContainment({
        key: containmentSignature,
        command: currentPlaybackCommand,
        locomotionState: currentGameplayState?.locomotionState,
        profile: containment.profile,
        source: containment.source,
        clipName: currentGroup.name,
        filteredTargetNames: Array.from(filteredTargetNames),
        maxVerticalDrift,
        maxHorizontalDrift,
        loggerPrefix: options.loggerPrefix
      });
    }
  };

  const restartCurrentGroup = (): void => {
    if (!currentGroup || !currentPlaybackCommand) {
      return;
    }

    currentGroup.stop();
    currentGroup.reset();
    startGroupForCommand(
      currentGroup,
      currentPlaybackCommand,
      shouldLoopCommand(currentPlaybackCommand, options.animationConfig)
    );
  };

  const play = (requestedCommand: AnimationCommand, forceRestart = false): void => {
    if (currentRequestedCommand === requestedCommand) {
      if (currentGroup && currentPlaybackCommand) {
        if (!forceRestart && NON_RESTARTABLE_SAME_COMMANDS.includes(currentPlaybackCommand)) {
          return;
        }

        const isLooping = shouldLoopCommand(currentPlaybackCommand, options.animationConfig);
        if (forceRestart) {
          restartCurrentGroup();
          return;
        }
      }
      return;
    }

    if (currentGroup && currentPlaybackCommand) {
      const currentIsLooping = shouldLoopCommand(currentPlaybackCommand, options.animationConfig);

      if (!currentIsLooping && currentGroup.isPlaying) {
        const protectedCommands: readonly AnimationCommand[] = [
          "rolling",
          "ledgeClimb",
          "ultimate",
          "attack1",
          "attack2",
          "attack3",
          "hit",
          "death"
        ] as const;
        const canOverrideByPriority =
          !protectedCommands.includes(currentPlaybackCommand) ||
          resolveCommandPriority(requestedCommand) > resolveCommandPriority(currentPlaybackCommand);

        if (!canOverrideByPriority) {
          return;
        }
      }
    }

    const playableAnimation = resolvePlayableAnimation(requestedCommand);
    if (!playableAnimation) {
      return;
    }

    if (currentGroup === playableAnimation.group) {
      if (forceRestart) {
        currentRequestedCommand = requestedCommand;
        currentPlaybackCommand = playableAnimation.playbackCommand;
        restartCurrentGroup();
        return;
      }

      currentRequestedCommand = requestedCommand;
      currentPlaybackCommand = playableAnimation.playbackCommand;
      return;
    }

    if (currentGroup) {
      currentGroup.stop();
    }

    playableAnimation.group.reset();
    startGroupForCommand(
      playableAnimation.group,
      playableAnimation.playbackCommand,
      shouldLoopCommand(playableAnimation.playbackCommand, options.animationConfig)
    );

    currentGroup = playableAnimation.group;
    currentRequestedCommand = requestedCommand;
    currentPlaybackCommand = playableAnimation.playbackCommand;
    applyRuntimeContainment();
  };

  return {
    play,
    syncFromGameplay: (gameplayState) => {
      currentGameplayState = gameplayState;
      const nextCommand = resolveAnimationCommandFromGameplay(gameplayState);
      play(nextCommand, gameplayState.restartCommand === nextCommand);
      applyRuntimeContainment();
    },
    stop: () => {
      if (!currentGroup) {
        return;
      }

      currentGroup.stop();
      currentGroup = null;
      currentRequestedCommand = null;
      currentPlaybackCommand = null;
      currentGameplayState = null;
      baselineByTarget = new WeakMap<object, Vector3>();
      lastContainmentSignature = "";
    },
    getCurrentCommand: () => currentRequestedCommand,
    dispose: () => {
      if (currentGroup) {
        currentGroup.stop();
      }

      currentGroup = null;
      currentRequestedCommand = null;
      currentPlaybackCommand = null;
      currentGameplayState = null;
      baselineByTarget = new WeakMap<object, Vector3>();
      lastContainmentSignature = "";
      warnedMissingMappings.clear();
      warnedMissingGroups.clear();
      warnedEmbeddedFallbackUsage.clear();
    }
  };
}
