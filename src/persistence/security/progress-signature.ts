import {
  PLAYER_PROGRESS_SIGNATURE_ALGORITHM,
  type PlayerProgressDocument,
  type PlayerProgressPayload
} from "../types/player-progress.types";

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, "0");
}

export function normalizeProgressPayload(payload: PlayerProgressPayload): string {
  return JSON.stringify(normalizeValue(payload));
}

export function signProgressPayload(payload: PlayerProgressPayload): string {
  return fnv1a64(normalizeProgressPayload(payload));
}

export function attachProgressSignature(payload: PlayerProgressPayload): PlayerProgressDocument {
  return {
    ...payload,
    integrity: {
      algorithm: PLAYER_PROGRESS_SIGNATURE_ALGORITHM,
      signature: signProgressPayload(payload)
    }
  };
}

export function hasValidProgressSignature(document: PlayerProgressDocument): boolean {
  if (document.integrity.algorithm !== PLAYER_PROGRESS_SIGNATURE_ALGORITHM) {
    return false;
  }

  return signProgressPayload({
    saveVersion: document.saveVersion,
    gameVersion: document.gameVersion,
    playerId: document.playerId,
    profile: document.profile,
    champions: document.champions,
    selectedChampionId: document.selectedChampionId,
    settings: document.settings,
    metadata: document.metadata
  }) === document.integrity.signature;
}
