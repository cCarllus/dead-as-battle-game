// Responsável por centralizar os atributos de combate por herói no servidor autoritativo.
import {
  REGISTERED_COMBAT_HERO_IDS,
  resolveCombatKitDefinition
} from "../combat/combat-definition.js";

export type HeroCombatServerConfig = {
  id: string;
  maxHealth: number;
  ultimateMax: number;
};

const HERO_COMBAT_CONFIG_BY_ID: Record<string, HeroCombatServerConfig> = {
  default_champion: {
    id: "default_champion",
    maxHealth: 1000,
    ultimateMax: 100
  }
};

export const VALID_HERO_IDS = new Set<string>([
  ...REGISTERED_COMBAT_HERO_IDS,
  ...Object.keys(HERO_COMBAT_CONFIG_BY_ID)
]);

export function resolveHeroCombatServerConfig(heroId: string): HeroCombatServerConfig {
  const resolved = HERO_COMBAT_CONFIG_BY_ID[heroId];
  if (resolved) {
    return resolved;
  }

  const kit = resolveCombatKitDefinition(heroId);
  return {
    id: VALID_HERO_IDS.has(heroId) ? heroId : "default_champion",
    maxHealth: kit.maxHealth,
    ultimateMax: 100
  };
}
