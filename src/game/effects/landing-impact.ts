// Responsável por normalizar intensidade de impacto de aterrissagem a partir do tempo no ar.
import { clamp } from "../utils/math";

export function resolveLandingImpactFromAirTime(airborneTimeMs: number): number {
  const normalized = (airborneTimeMs - 120) / 520;
  return clamp(normalized, 0, 1);
}
