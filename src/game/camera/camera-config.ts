// Responsible for centralizing shoulder-camera tuning so combat framing and reactions stay easy to tune.
export type ThirdPersonCameraConfig = {
  baseDistance: number;
  minDistance: number;
  baseHeight: number;
  shoulderOffsetX: number;
  shoulderOffsetY: number;
  shoulderOffsetZ: number;
  targetShoulderOffsetX: number;
  targetLeadDistance: number;
  cameraTargetOffsetY: number;
  crouchHeightOffset: number;
  crouchTargetOffsetY: number;
  sprintDistanceOffset: number;
  sprintLeadOffset: number;
  sprintFollowLerpMultiplier: number;
  rollDistanceOffset: number;
  rollHeightOffset: number;
  rollLeadOffset: number;
  rollFollowLerpMultiplier: number;
  ledgeDistanceOffset: number;
  ledgeHeightOffset: number;
  ledgeTargetOffsetY: number;
  climbDistanceOffset: number;
  climbHeightOffset: number;
  climbTargetOffsetY: number;
  parkourDistanceOffset: number;
  parkourHeightOffset: number;
  parkourTargetOffsetY: number;
  parkourFollowLerpMultiplier: number;
  baseFovRadians: number;
  sprintFovRadians: number;
  rollFovRadians: number;
  parkourFovRadians: number;
  userFovAdjustmentRadians: number;
  minAllowedFovRadians: number;
  maxAllowedFovRadians: number;
  followLerpSpeed: number;
  rotationLerpSpeed: number;
  fovLerpSpeed: number;
  collisionLerpSpeed: number;
  collisionRecoveryLerpSpeed: number;
  cameraCollisionRadius: number;
  collisionBuffer: number;
  minPitch: number;
  maxPitch: number;
  sensitivityX: number;
  sensitivityY: number;
  invertY: boolean;
  wallRunRollRadians: number;
  sprintTurnTiltRadians: number;
  tiltLerpSpeed: number;
  landingDropBase: number;
  landingDropScale: number;
  landingRecoverySpeed: number;
  sprintBurstFovKickRadians: number;
  sprintCameraVibration: number;
  debugLogIntervalMs: number;
};

export const DEFAULT_CAMERA_SETTINGS_PERCENT = 50;

export const DEFAULT_THIRD_PERSON_CAMERA_CONFIG: Readonly<ThirdPersonCameraConfig> = {
  baseDistance: 3.02,
  minDistance: 1.4,
  baseHeight: 0.48,
  shoulderOffsetX: 1.18,
  shoulderOffsetY: 0.28,
  shoulderOffsetZ: 0.2,
  targetShoulderOffsetX: 0.24,
  targetLeadDistance: 0.38,
  cameraTargetOffsetY: 0.32,
  crouchHeightOffset: -0.22,
  crouchTargetOffsetY: -0.16,
  sprintDistanceOffset: 0.08,
  sprintLeadOffset: 0.05,
  sprintFollowLerpMultiplier: 1.08,
  rollDistanceOffset: -0.16,
  rollHeightOffset: -0.14,
  rollLeadOffset: 0.18,
  rollFollowLerpMultiplier: 1.12,
  ledgeDistanceOffset: 0.28,
  ledgeHeightOffset: 0.18,
  ledgeTargetOffsetY: -0.04,
  climbDistanceOffset: 0.22,
  climbHeightOffset: 0.24,
  climbTargetOffsetY: 0.08,
  parkourDistanceOffset: 0.18,
  parkourHeightOffset: 0.1,
  parkourTargetOffsetY: 0.06,
  parkourFollowLerpMultiplier: 1.12,
  baseFovRadians: (68 * Math.PI) / 180,
  sprintFovRadians: (72 * Math.PI) / 180,
  rollFovRadians: (74 * Math.PI) / 180,
  parkourFovRadians: (73 * Math.PI) / 180,
  userFovAdjustmentRadians: 0,
  minAllowedFovRadians: (56 * Math.PI) / 180,
  maxAllowedFovRadians: (98 * Math.PI) / 180,
  followLerpSpeed: 12.2,
  rotationLerpSpeed: 21.5,
  fovLerpSpeed: 8.5,
  collisionLerpSpeed: 24,
  collisionRecoveryLerpSpeed: 8.5,
  cameraCollisionRadius: 0.24,
  collisionBuffer: 0.12,
  minPitch: (-38 * Math.PI) / 180,
  maxPitch: (52 * Math.PI) / 180,
  sensitivityX: 0.00235,
  sensitivityY: 0.002,
  invertY: false,
  wallRunRollRadians: (6 * Math.PI) / 180,
  sprintTurnTiltRadians: (2 * Math.PI) / 180,
  tiltLerpSpeed: 10,
  landingDropBase: 0.025,
  landingDropScale: 0.06,
  landingRecoverySpeed: 7,
  sprintBurstFovKickRadians: (1.8 * Math.PI) / 180,
  sprintCameraVibration: 0.0008,
  debugLogIntervalMs: 160
};

export function cloneThirdPersonCameraConfig(
  config: ThirdPersonCameraConfig
): ThirdPersonCameraConfig {
  return { ...config };
}

export function mergeThirdPersonCameraConfig(
  ...configs: Array<Partial<ThirdPersonCameraConfig> | undefined>
): ThirdPersonCameraConfig {
  const mergedConfig: ThirdPersonCameraConfig = { ...DEFAULT_THIRD_PERSON_CAMERA_CONFIG };

  configs.forEach((config) => {
    if (!config) {
      return;
    }

    (Object.keys(config) as Array<keyof ThirdPersonCameraConfig>).forEach((key) => {
      const value = config[key];
      if (value !== undefined) {
        (mergedConfig as Record<keyof ThirdPersonCameraConfig, ThirdPersonCameraConfig[keyof ThirdPersonCameraConfig]>)[
          key
        ] = value as ThirdPersonCameraConfig[keyof ThirdPersonCameraConfig];
      }
    });
  });

  return mergedConfig;
}

export function resolveConfiguredBaseFovRadians(config: ThirdPersonCameraConfig): number {
  const desiredFov = config.baseFovRadians + config.userFovAdjustmentRadians;
  return Math.min(config.maxAllowedFovRadians, Math.max(config.minAllowedFovRadians, desiredFov));
}

export function clampCameraSettingsPercent(
  value: number,
  fallback: number = DEFAULT_CAMERA_SETTINGS_PERCENT
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  if (normalized < 1) {
    return 1;
  }

  if (normalized > 100) {
    return 100;
  }

  return normalized;
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

export function resolveFovAdjustmentRadiansFromPercent(
  config: ThirdPersonCameraConfig,
  percent: number
): number {
  const safePercent = clampCameraSettingsPercent(percent);
  if (safePercent === DEFAULT_CAMERA_SETTINGS_PERCENT) {
    return 0;
  }

  const targetFovRadians =
    safePercent < DEFAULT_CAMERA_SETTINGS_PERCENT
      ? lerp(
          config.minAllowedFovRadians,
          config.baseFovRadians,
          (safePercent - 1) / (DEFAULT_CAMERA_SETTINGS_PERCENT - 1)
        )
      : lerp(
          config.baseFovRadians,
          config.maxAllowedFovRadians,
          (safePercent - DEFAULT_CAMERA_SETTINGS_PERCENT) /
            (100 - DEFAULT_CAMERA_SETTINGS_PERCENT)
        );

  return targetFovRadians - config.baseFovRadians;
}

export function resolveCameraDistanceOffsetFromPercent(percent: number): number {
  const safePercent = clampCameraSettingsPercent(percent);
  if (safePercent <= DEFAULT_CAMERA_SETTINGS_PERCENT) {
    return 0;
  }

  const alpha =
    (safePercent - DEFAULT_CAMERA_SETTINGS_PERCENT) /
    (100 - DEFAULT_CAMERA_SETTINGS_PERCENT);
  return lerp(0, 0.65, alpha);
}
