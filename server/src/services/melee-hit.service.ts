// Responsável por validar alcance/cone frontal e selecionar alvo válido para ataques melee autoritativos.
import type { MatchPlayerState } from "../models/match-player.model.js";

export const MELEE_HIT_CONFIG = {
  meleeRange: 3,
  meleeConeAngleDegrees: 60,
  verticalTolerance: 2.8
} as const;

function normalize2D(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  if (length <= 0.000001) {
    return { x: 0, z: 0 };
  }

  return {
    x: x / length,
    z: z / length
  };
}

function resolveForwardVector(rotationY: number): { x: number; z: number } {
  return {
    x: Math.sin(rotationY),
    z: Math.cos(rotationY)
  };
}

function isInsideMeleeCone(attacker: MatchPlayerState, target: MatchPlayerState): boolean {
  const toTargetX = target.x - attacker.x;
  const toTargetZ = target.z - attacker.z;
  const toTarget = normalize2D(toTargetX, toTargetZ);
  if (toTarget.x === 0 && toTarget.z === 0) {
    return true;
  }

  const forward = normalize2D(resolveForwardVector(attacker.rotationY).x, resolveForwardVector(attacker.rotationY).z);
  const dot = forward.x * toTarget.x + forward.z * toTarget.z;
  const minDot = Math.cos((MELEE_HIT_CONFIG.meleeConeAngleDegrees * Math.PI) / 360);
  return dot >= minDot;
}

export function isTargetInMeleeRange(attacker: MatchPlayerState, target: MatchPlayerState): boolean {
  const deltaX = target.x - attacker.x;
  const deltaZ = target.z - attacker.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);
  const verticalDistance = Math.abs(target.y - attacker.y);

  return horizontalDistance <= MELEE_HIT_CONFIG.meleeRange && verticalDistance <= MELEE_HIT_CONFIG.verticalTolerance;
}

export function pickBestMeleeTarget(
  attacker: MatchPlayerState,
  players: Iterable<MatchPlayerState>
): MatchPlayerState | null {
  let bestTarget: MatchPlayerState | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const candidate of players) {
    if (candidate.sessionId === attacker.sessionId) {
      continue;
    }

    if (!candidate.isAlive) {
      continue;
    }

    if (!isTargetInMeleeRange(attacker, candidate)) {
      continue;
    }

    if (!isInsideMeleeCone(attacker, candidate)) {
      continue;
    }

    const deltaX = candidate.x - attacker.x;
    const deltaZ = candidate.z - attacker.z;
    const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestTarget = candidate;
    }
  }

  return bestTarget;
}

export function applyLightKnockback(
  attacker: MatchPlayerState,
  target: MatchPlayerState,
  strength: number
): void {
  const directionX = target.x - attacker.x;
  const directionZ = target.z - attacker.z;
  const normalizedDirection = normalize2D(directionX, directionZ);

  if (normalizedDirection.x === 0 && normalizedDirection.z === 0) {
    const fallbackForward = resolveForwardVector(attacker.rotationY);
    const fallback = normalize2D(fallbackForward.x, fallbackForward.z);
    target.x += fallback.x * strength;
    target.z += fallback.z * strength;
    return;
  }

  target.x += normalizedDirection.x * strength;
  target.z += normalizedDirection.z * strength;
}
