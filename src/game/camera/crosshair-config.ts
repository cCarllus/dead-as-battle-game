// Responsible for centralizing shoulder-crosshair tuning so screen framing stays aligned with camera aiming.
export const RIGHT_SHOULDER_SIDE = 1;
export const LEFT_SHOULDER_SIDE = -1;

export type ShoulderCrosshairConfig = {
  screenOffsetX: number;
  screenOffsetY: number;
  scale: number;
  opacity: number;
  aimMaxDistance: number;
};

export const DEFAULT_SHOULDER_CROSSHAIR_CONFIG: Readonly<ShoulderCrosshairConfig> = {
  screenOffsetX: 0.024,
  screenOffsetY: -0.096,
  scale: 1,
  opacity: 0.92,
  aimMaxDistance: 220
};

export function clampCrosshairNormalizedOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.32, Math.max(-0.32, value));
}

export function resolveCrosshairNormalizedScreenPosition(
  config: ShoulderCrosshairConfig,
  shoulderSide: number = RIGHT_SHOULDER_SIDE
): {
  x: number;
  y: number;
} {
  return {
    x: Math.min(
      0.95,
      Math.max(0.05, 0.5 + clampCrosshairNormalizedOffset(config.screenOffsetX * shoulderSide))
    ),
    y: Math.min(0.95, Math.max(0.05, 0.5 + clampCrosshairNormalizedOffset(config.screenOffsetY)))
  };
}
