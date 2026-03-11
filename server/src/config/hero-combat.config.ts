// Responsável por centralizar os atributos de combate por herói no servidor autoritativo.

export type HeroCombatServerConfig = {
  id: "default_champion";
  maxHealth: number;
  ultimateMax: number;
};

const HERO_COMBAT_CONFIG_BY_ID: Record<HeroCombatServerConfig["id"], HeroCombatServerConfig> = {
  default_champion: {
    id: "default_champion",
    maxHealth: 1000,
    ultimateMax: 100
  }
};

export const VALID_HERO_IDS = new Set<string>(Object.keys(HERO_COMBAT_CONFIG_BY_ID));

export function resolveHeroCombatServerConfig(heroId: string): HeroCombatServerConfig {
  const resolved = HERO_COMBAT_CONFIG_BY_ID[heroId as HeroCombatServerConfig["id"]];
  return resolved ?? HERO_COMBAT_CONFIG_BY_ID.default_champion;
}
