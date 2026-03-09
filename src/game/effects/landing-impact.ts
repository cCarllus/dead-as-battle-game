// Responsável por normalizar intensidade de impacto de aterrissagem a partir do tempo no ar.
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveLandingImpactFromAirTime(airborneTimeMs: number): number {
  const normalized = (airborneTimeMs - 120) / 520;
  return clamp(normalized, 0, 1);
}
