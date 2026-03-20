// Responsável por centralizar políticas de contenção de motion por comando/estado, com fallback conservador para traversal.
import { Animation, Vector3 } from "@babylonjs/core";
import type { CharacterLocomotionState } from "../locomotion/locomotion-state";
import type { AnimationCommand } from "./animation-command";

export type AxisMask = {
  x: boolean;
  y: boolean;
  z: boolean;
};

export type AnimationContainmentMode = "off" | "partial" | "full" | "logic-only";

export type BoneContainmentProfile = {
  root: AxisMask;
  hips: AxisMask;
  pelvis: AxisMask;
  description: string;
};

export type ContainmentResolveResult = {
  mode: AnimationContainmentMode;
  profile: BoneContainmentProfile | null;
  source: "command" | "state" | "fallback" | "none";
};

export type PositionTrackFilterResult = {
  suppressTrack: boolean;
  filteredAnimation: Animation | null;
  blockedAxes: AxisMask | null;
};

const DEFAULT_CONTAINMENT_MODE: AnimationContainmentMode = "full";
const DEBUG_LOG_THROTTLE_MS = 260;
const TRAVERSAL_STATES = new Set<string>([
  "Hanging",
  "LedgeHang",
  "ClimbingUp",
  "LedgeClimb",
  "MantlingLowObstacle",
  "Rolling"
]);

const ROOT_KEYWORDS = [
  "root",
  "rootmotion",
  "armature",
  "characterroot",
  "globalctrl",
  "skeletonroot"
];
const HIPS_KEYWORDS = ["hips", "mixamorig:hips", "mixamorig_hips", "hip"];
const PELVIS_KEYWORDS = ["pelvis"];

const AXIS_NONE: AxisMask = { x: false, y: false, z: false };
const AXIS_ALL: AxisMask = { x: true, y: true, z: true };
const AXIS_VERTICAL: AxisMask = { x: false, y: true, z: false };

const COMMAND_CONTAINMENT_FULL: Partial<Record<AnimationCommand, BoneContainmentProfile>> = {
  ledgeHang: {
    root: AXIS_ALL,
    hips: AXIS_ALL,
    pelvis: AXIS_ALL,
    description: "wall-hanging-idle containment (root/hips/pelvis locked)"
  },
  ledgeClimb: {
    root: AXIS_ALL,
    hips: AXIS_ALL,
    pelvis: AXIS_ALL,
    description: "up-wall containment (traversal stays code-driven)"
  },
  rolling: {
    root: AXIS_ALL,
    hips: AXIS_ALL,
    pelvis: AXIS_ALL,
    description: "quick-roll containment (no vertical/horizontal drift)"
  }
};

const STATE_CONTAINMENT_FULL: Partial<Record<string, BoneContainmentProfile>> = {
  Hanging: COMMAND_CONTAINMENT_FULL.ledgeHang,
  LedgeHang: COMMAND_CONTAINMENT_FULL.ledgeHang,
  ClimbingUp: COMMAND_CONTAINMENT_FULL.ledgeClimb,
  LedgeClimb: COMMAND_CONTAINMENT_FULL.ledgeClimb,
  MantlingLowObstacle: COMMAND_CONTAINMENT_FULL.ledgeClimb,
  Rolling: COMMAND_CONTAINMENT_FULL.rolling
};

let lastContainmentDebugAtMs = 0;
const loggedBindingMessages = new Set<string>();
const loggedRuntimeMessages = new Set<string>();

function cloneMask(mask: AxisMask): AxisMask {
  return { x: mask.x, y: mask.y, z: mask.z };
}

function normalizeTargetName(name: string | null | undefined): string {
  if (!name) {
    return "";
  }

  return name.trim().toLowerCase();
}

function parseContainmentMode(value: unknown): AnimationContainmentMode | null {
  if (typeof value !== "string") {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case "off":
      return "off";
    case "partial":
      return "partial";
    case "full":
      return "full";
    case "logic-only":
    case "logic_only":
    case "logiconly":
      return "logic-only";
    default:
      return null;
  }
}

function resolveGlobalDebugFlag(): boolean {
  const globalValue = (globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown })
    .__DAB_ADVANCED_MOVEMENT_DEBUG__;
  return globalValue === true || import.meta.env.DEV;
}

function logContainment(message: string, payload: Record<string, unknown>, scope: "binding" | "runtime"): void {
  if (!resolveGlobalDebugFlag()) {
    return;
  }

  const now = Date.now();
  if (scope === "runtime" && now - lastContainmentDebugAtMs < DEBUG_LOG_THROTTLE_MS) {
    return;
  }
  if (scope === "runtime") {
    lastContainmentDebugAtMs = now;
  }

  console.debug(`[animation][containment] ${message}`, payload);
}

export function resolveAnimationContainmentMode(): AnimationContainmentMode {
  const explicitMode = parseContainmentMode(
    (globalThis as { __DAB_ANIM_CONTAINMENT_MODE__?: unknown }).__DAB_ANIM_CONTAINMENT_MODE__
  );
  return explicitMode ?? DEFAULT_CONTAINMENT_MODE;
}

export function isVisualOffsetEnabled(): boolean {
  const explicitToggle = (globalThis as { __DAB_ANIM_VISUAL_OFFSET__?: unknown }).__DAB_ANIM_VISUAL_OFFSET__;
  if (typeof explicitToggle === "boolean") {
    return explicitToggle;
  }

  return true;
}

function toPartialProfile(profile: BoneContainmentProfile): BoneContainmentProfile {
  return {
    root: cloneMask(profile.root),
    hips: AXIS_VERTICAL,
    pelvis: AXIS_VERTICAL,
    description: `${profile.description} (partial mode: vertical-only on hips/pelvis)`
  };
}

function toLogicOnlyProfile(profile: BoneContainmentProfile): BoneContainmentProfile {
  return {
    root: AXIS_ALL,
    hips: AXIS_ALL,
    pelvis: AXIS_ALL,
    description: `${profile.description} (logic-only mode: full translation lock)`
  };
}

function resolveProfileByCommand(command: AnimationCommand | null): BoneContainmentProfile | null {
  if (!command) {
    return null;
  }

  return COMMAND_CONTAINMENT_FULL[command] ?? null;
}

function resolveProfileByState(locomotionState: CharacterLocomotionState | string | undefined): BoneContainmentProfile | null {
  if (!locomotionState) {
    return null;
  }

  return STATE_CONTAINMENT_FULL[String(locomotionState)] ?? null;
}

function resolveFallbackProfile(
  locomotionState: CharacterLocomotionState | string | undefined
): BoneContainmentProfile | null {
  if (!locomotionState || !TRAVERSAL_STATES.has(String(locomotionState))) {
    return null;
  }

  return {
    root: AXIS_ALL,
    hips: AXIS_ALL,
    pelvis: AXIS_ALL,
    description: "conservative traversal fallback containment (root/hips/pelvis locked)"
  };
}

function applyModeToProfile(
  profile: BoneContainmentProfile,
  mode: AnimationContainmentMode
): BoneContainmentProfile | null {
  if (mode === "off") {
    return null;
  }

  if (mode === "partial") {
    return toPartialProfile(profile);
  }

  if (mode === "logic-only") {
    return toLogicOnlyProfile(profile);
  }

  return {
    root: cloneMask(profile.root),
    hips: cloneMask(profile.hips),
    pelvis: cloneMask(profile.pelvis),
    description: profile.description
  };
}

function includesAnyKeyword(targetName: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => targetName.includes(keyword));
}

export function resolveBoneContainmentAxes(
  profile: BoneContainmentProfile | null,
  targetName: string | null | undefined
): AxisMask | null {
  if (!profile) {
    return null;
  }

  const normalizedName = normalizeTargetName(targetName);
  if (!normalizedName) {
    return null;
  }

  if (includesAnyKeyword(normalizedName, PELVIS_KEYWORDS)) {
    return cloneMask(profile.pelvis);
  }

  if (includesAnyKeyword(normalizedName, HIPS_KEYWORDS)) {
    return cloneMask(profile.hips);
  }

  if (includesAnyKeyword(normalizedName, ROOT_KEYWORDS)) {
    return cloneMask(profile.root);
  }

  return null;
}

export function resolveContainmentProfile(params: {
  command: AnimationCommand | null;
  locomotionState: CharacterLocomotionState | string | undefined;
  mode?: AnimationContainmentMode;
}): ContainmentResolveResult {
  const mode = params.mode ?? resolveAnimationContainmentMode();
  if (mode === "off") {
    return {
      mode,
      profile: null,
      source: "none"
    };
  }

  const commandProfile = resolveProfileByCommand(params.command);
  if (commandProfile) {
    return {
      mode,
      profile: applyModeToProfile(commandProfile, mode),
      source: "command"
    };
  }

  const stateProfile = resolveProfileByState(params.locomotionState);
  if (stateProfile) {
    return {
      mode,
      profile: applyModeToProfile(stateProfile, mode),
      source: "state"
    };
  }

  const fallbackProfile = resolveFallbackProfile(params.locomotionState);
  if (fallbackProfile) {
    return {
      mode,
      profile: applyModeToProfile(fallbackProfile, mode),
      source: "fallback"
    };
  }

  return {
    mode,
    profile: null,
    source: "none"
  };
}

function isVectorLike(value: unknown): value is { x: number; y: number; z: number } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { x?: unknown; y?: unknown; z?: unknown };
  return (
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.z === "number"
  );
}

function isNumericKeyValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeAnimationProperty(targetProperty: string): string {
  return targetProperty.trim().toLowerCase();
}

export function isPositionTrackProperty(targetProperty: string): boolean {
  const normalized = normalizeAnimationProperty(targetProperty);
  return (
    normalized === "position" ||
    normalized === "translation" ||
    normalized.startsWith("position.") ||
    normalized.startsWith("translation.")
  );
}

function resolvePropertyAxis(targetProperty: string): "x" | "y" | "z" | null {
  const normalized = normalizeAnimationProperty(targetProperty);
  if (normalized.endsWith(".x")) {
    return "x";
  }
  if (normalized.endsWith(".y")) {
    return "y";
  }
  if (normalized.endsWith(".z")) {
    return "z";
  }
  return null;
}

function allAxesBlocked(mask: AxisMask): boolean {
  return mask.x && mask.y && mask.z;
}

function anyAxisBlocked(mask: AxisMask): boolean {
  return mask.x || mask.y || mask.z;
}

export function filterPositionTrackForAxes(params: {
  animation: Animation;
  targetProperty: string;
  blockedAxes: AxisMask;
}): PositionTrackFilterResult {
  if (!anyAxisBlocked(params.blockedAxes)) {
    return {
      suppressTrack: false,
      filteredAnimation: params.animation,
      blockedAxes: AXIS_NONE
    };
  }

  const scalarAxis = resolvePropertyAxis(params.targetProperty);
  if (scalarAxis) {
    const shouldSuppressScalar = params.blockedAxes[scalarAxis];
    return {
      suppressTrack: shouldSuppressScalar,
      filteredAnimation: shouldSuppressScalar ? null : params.animation,
      blockedAxes: shouldSuppressScalar ? cloneMask(params.blockedAxes) : AXIS_NONE
    };
  }

  if (allAxesBlocked(params.blockedAxes)) {
    return {
      suppressTrack: true,
      filteredAnimation: null,
      blockedAxes: cloneMask(params.blockedAxes)
    };
  }

  const sourceKeys = params.animation.getKeys();
  if (!Array.isArray(sourceKeys) || sourceKeys.length === 0) {
    return {
      suppressTrack: false,
      filteredAnimation: params.animation,
      blockedAxes: AXIS_NONE
    };
  }

  const firstVectorKey = sourceKeys.find((key) => isVectorLike((key as { value?: unknown }).value));
  if (!firstVectorKey) {
    return {
      suppressTrack: false,
      filteredAnimation: params.animation,
      blockedAxes: AXIS_NONE
    };
  }

  const firstValue = (firstVectorKey as { value: { x: number; y: number; z: number } }).value;
  const baseline = new Vector3(firstValue.x, firstValue.y, firstValue.z);

  const filteredKeys = sourceKeys.map((rawKey) => {
    const key = rawKey as { value?: unknown };
    if (!isVectorLike(key.value)) {
      return rawKey;
    }

    const nextValue = new Vector3(key.value.x, key.value.y, key.value.z);
    if (params.blockedAxes.x) {
      nextValue.x = baseline.x;
    }
    if (params.blockedAxes.y) {
      nextValue.y = baseline.y;
    }
    if (params.blockedAxes.z) {
      nextValue.z = baseline.z;
    }

    const rawKeyObject = rawKey as unknown as {
      frame: number;
      value: unknown;
      inTangent?: number | Vector3;
      outTangent?: number | Vector3;
      interpolation?: number;
    };

    return {
      frame: rawKeyObject.frame,
      value: nextValue,
      inTangent: rawKeyObject.inTangent,
      outTangent: rawKeyObject.outTangent,
      interpolation: rawKeyObject.interpolation
    };
  });

  params.animation.setKeys(filteredKeys as Array<{
    frame: number;
    value: number | Vector3;
    inTangent?: number | Vector3;
    outTangent?: number | Vector3;
    interpolation?: number;
  }>);

  return {
    suppressTrack: false,
    filteredAnimation: params.animation,
    blockedAxes: cloneMask(params.blockedAxes)
  };
}

export function roundVector(value: Vector3): { x: number; y: number; z: number } {
  return {
    x: Math.round(value.x * 1000) / 1000,
    y: Math.round(value.y * 1000) / 1000,
    z: Math.round(value.z * 1000) / 1000
  };
}

export function resolvePositionFromTarget(target: unknown): Vector3 | null {
  const targetWithPosition = target as { position?: unknown } | null | undefined;
  if (!targetWithPosition || !isVectorLike(targetWithPosition.position)) {
    return null;
  }

  return new Vector3(
    targetWithPosition.position.x,
    targetWithPosition.position.y,
    targetWithPosition.position.z
  );
}

export function applyAxisLockToTargetPosition(target: unknown, baseline: Vector3, axes: AxisMask): boolean {
  const targetWithPosition = target as { position?: unknown } | null | undefined;
  if (!targetWithPosition || !isVectorLike(targetWithPosition.position)) {
    return false;
  }

  const nextPosition = targetWithPosition.position;
  if (axes.x) {
    nextPosition.x = baseline.x;
  }
  if (axes.y) {
    nextPosition.y = baseline.y;
  }
  if (axes.z) {
    nextPosition.z = baseline.z;
  }
  return true;
}

export function logTrackContainment(params: {
  key: string;
  command: AnimationCommand;
  clipLabel?: string;
  targetName: string | null;
  targetProperty: string;
  blockedAxes: AxisMask;
  action: "suppress" | "axis-filter";
  source: "command" | "state" | "fallback" | "none";
  loggerPrefix?: string;
}): void {
  if (loggedBindingMessages.has(params.key)) {
    return;
  }
  loggedBindingMessages.add(params.key);

  const prefix = params.loggerPrefix ? `${params.loggerPrefix} ` : "";
  const targetLabel = params.targetName ?? "<unnamed-target>";
  const axisLabel = `${params.blockedAxes.x ? "X" : ""}${params.blockedAxes.y ? "Y" : ""}${params.blockedAxes.z ? "Z" : ""}`;
  const clipLabel = params.clipLabel ? ` (${params.clipLabel})` : "";

  logContainment(
    `${prefix}${params.action === "suppress" ? "Filtering" : "Constrain"} ${targetLabel} position track for '${params.command}'${clipLabel}`,
    {
      command: params.command,
      clip: params.clipLabel ?? null,
      targetName: params.targetName,
      targetProperty: params.targetProperty,
      blockedAxes: axisLabel || "none",
      source: params.source
    },
    "binding"
  );
}

export function logRuntimeContainment(params: {
  key: string;
  command: AnimationCommand | null;
  locomotionState: CharacterLocomotionState | string | undefined;
  profile: BoneContainmentProfile;
  source: "command" | "state" | "fallback" | "none";
  clipName: string;
  filteredTargetNames: string[];
  maxVerticalDrift: number;
  maxHorizontalDrift: number;
  loggerPrefix?: string;
}): void {
  if (!resolveGlobalDebugFlag()) {
    return;
  }

  if (!loggedRuntimeMessages.has(params.key)) {
    loggedRuntimeMessages.add(params.key);
    const prefix = params.loggerPrefix ? `${params.loggerPrefix} ` : "";
    console.debug(`${prefix}Applying runtime containment`, {
      command: params.command,
      locomotionState: params.locomotionState,
      source: params.source,
      clipName: params.clipName,
      profile: params.profile.description
    });
  }

  logContainment(
    "runtime drift monitor",
    {
      command: params.command,
      locomotionState: params.locomotionState,
      source: params.source,
      clipName: params.clipName,
      filteredTargetNames: params.filteredTargetNames,
      maxVerticalDrift: Math.round(params.maxVerticalDrift * 1000) / 1000,
      maxHorizontalDrift: Math.round(params.maxHorizontalDrift * 1000) / 1000
    },
    "runtime"
  );
}

export function isScalarPositionTrackValue(value: unknown): boolean {
  return isNumericKeyValue(value);
}
