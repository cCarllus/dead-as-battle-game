// Shared pure math utilities used across the game engine.

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }

  return Math.max(current - maxDelta, target);
}

export function normalizeAngleRadians(angle: number): number {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized > Math.PI) {
    normalized -= tau;
  }
  if (normalized < -Math.PI) {
    normalized += tau;
  }
  return normalized;
}

export function squaredDistance3D(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
