// Responsável por reproduzir AnimationGroups usando comandos padrão e mapeamento específico de herói.
import type { AnimationGroup } from "@babylonjs/core";
import {
  LOOPED_ANIMATION_COMMANDS,
  type AnimationCommand
} from "./animation-command";
import {
  type AnimationGameplayState,
  resolveAnimationCommandFromGameplay
} from "./animation-state";
import type { HeroAnimationConfig } from "./animation-types";

export type CreateAnimationControllerOptions = {
  animationGroups: AnimationGroup[];
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
  "jump",
  "jumpStart",
  "inAir",
  "land",
  "death"
];
const JUMP_START_TRIM_RATIO = 0.35;

function resolvePlaybackSpeedRatio(command: AnimationCommand): number {
  switch (command) {
    case "attack1":
    case "attack2":
    case "attack3":
      return 2.00;
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

  if (command !== "jump" && command !== "jumpStart") {
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
    case "jump":
    case "jumpStart":
    case "inAir":
    case "land":
      return 3;
    case "run":
      return 2;
    case "walk":
    case "walkBack":
    case "walkLeft":
    case "walkRight":
      return 1;
    case "idle":
    default:
      return 0;
  }
}

export function createAnimationController(options: CreateAnimationControllerOptions): AnimationController {
  const warnedMissingMappings = new Set<AnimationCommand>();
  const warnedMissingGroups = new Set<string>();

  const blendingDurationSeconds =
    typeof options.blendingDurationSeconds === "number" && options.blendingDurationSeconds >= 0
      ? options.blendingDurationSeconds
      : DEFAULT_BLENDING_DURATION_SECONDS;

  const normalizedGroups = options.animationGroups.map((group) => {
    group.stop();
    group.reset();
    group.enableBlending = blendingDurationSeconds > 0;
    group.blendingSpeed = blendingDurationSeconds > 0 ? 1 / Math.max(blendingDurationSeconds, 0.0001) : 0;

    return {
      group,
      normalizedName: normalizeNameForMatch(group.name)
    };
  });

  const findGroupByMappedName = (mappedGroupName: string): AnimationGroup | null => {
    const normalizedMappedName = normalizeNameForMatch(mappedGroupName);
    const exactMatch = normalizedGroups.find(({ normalizedName }) => normalizedName === normalizedMappedName);
    if (exactMatch) {
      return exactMatch.group;
    }

    const partialMatch = normalizedGroups.find(({ normalizedName }) => normalizedName.includes(normalizedMappedName));
    return partialMatch?.group ?? null;
  };

  const resolveMappedName = (command: AnimationCommand): string | null => {
    const mappedGroupName = options.animationConfig.commandToGroupName[command];
    if (mappedGroupName) {
      return mappedGroupName;
    }

    if (command === "death") {
      const hitFallback = options.animationConfig.commandToGroupName.hit;
      if (hitFallback) {
        return hitFallback;
      }
    }

    if (command === "jumpStart" || command === "inAir" || command === "land") {
      const jumpFallback = options.animationConfig.commandToGroupName.jump;
      if (jumpFallback) {
        return jumpFallback;
      }
    }

    if (!warnedMissingMappings.has(command)) {
      warnedMissingMappings.add(command);
      const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
      console.warn(`${prefix}Command '${command}' is not mapped for hero '${options.animationConfig.heroId}'.`);
    }

    if (command !== "idle") {
      return options.animationConfig.commandToGroupName.idle ?? null;
    }

    return null;
  };

  const resolvePlayableAnimation = (
    requestedCommand: AnimationCommand
  ): { playbackCommand: AnimationCommand; group: AnimationGroup } | null => {
    const mappedName = resolveMappedName(requestedCommand);
    if (mappedName) {
      const requestedGroup = findGroupByMappedName(mappedName);
      if (requestedGroup) {
        return {
          playbackCommand: requestedCommand,
          group: requestedGroup
        };
      }

      const missingKey = `${requestedCommand}:${mappedName}`;
      if (!warnedMissingGroups.has(missingKey)) {
        warnedMissingGroups.add(missingKey);
        const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
        console.warn(
          `${prefix}Mapped animation group '${mappedName}' for command '${requestedCommand}' was not found in GLB.`
        );
      }
    }

    if (requestedCommand !== "idle") {
      const idleName = options.animationConfig.commandToGroupName.idle;
      if (idleName) {
        const idleGroup = findGroupByMappedName(idleName);
        if (idleGroup) {
          return {
            playbackCommand: "idle",
            group: idleGroup
          };
        }
      }
    }

    return null;
  };

  let currentRequestedCommand: AnimationCommand | null = null;
  let currentPlaybackCommand: AnimationCommand | null = null;
  let currentGroup: AnimationGroup | null = null;

  const play = (requestedCommand: AnimationCommand): void => {
    if (currentRequestedCommand === requestedCommand) {
      if (currentGroup && currentPlaybackCommand) {
        if (NON_RESTARTABLE_SAME_COMMANDS.includes(currentPlaybackCommand)) {
          return;
        }

        const isLooping = shouldLoopCommand(currentPlaybackCommand, options.animationConfig);
        if (!isLooping && !currentGroup.isPlaying) {
          currentGroup.reset();
          currentGroup.start(false);
        }
      }
      return;
    }

    if (currentGroup && currentPlaybackCommand) {
      const currentIsLooping = shouldLoopCommand(currentPlaybackCommand, options.animationConfig);

      if (!currentIsLooping && currentGroup.isPlaying) {
        const canOverrideByPriority =
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
  };

  return {
    play,
    syncFromGameplay: (gameplayState) => {
      const nextCommand = resolveAnimationCommandFromGameplay(gameplayState);
      play(nextCommand);
    },
    stop: () => {
      if (!currentGroup) {
        return;
      }

      currentGroup.stop();
      currentGroup = null;
      currentRequestedCommand = null;
      currentPlaybackCommand = null;
    },
    getCurrentCommand: () => currentRequestedCommand,
    dispose: () => {
      if (currentGroup) {
        currentGroup.stop();
      }

      currentGroup = null;
      currentRequestedCommand = null;
      currentPlaybackCommand = null;
      warnedMissingMappings.clear();
      warnedMissingGroups.clear();
    }
  };
}
