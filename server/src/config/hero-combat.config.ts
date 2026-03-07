// Responsável por centralizar os atributos de combate por herói no servidor autoritativo.

export type HeroCombatServerConfig = {
  id: "user" | "sukuna" | "kaiju_no_8";
  maxHealth: number;
  ultimateMax: number;
};

const HERO_COMBAT_CONFIG_BY_ID: Record<HeroCombatServerConfig["id"], HeroCombatServerConfig> = {
  user: {
    id: "user",
    maxHealth: 1000,
    ultimateMax: 100
  },
  sukuna: {
    id: "sukuna",
    maxHealth: 900,
    ultimateMax: 100
  },
  kaiju_no_8: {
    id: "kaiju_no_8",
    maxHealth: 1400,
    ultimateMax: 100
  }
};

export const VALID_HERO_IDS = new Set<string>(Object.keys(HERO_COMBAT_CONFIG_BY_ID));

export function resolveHeroCombatServerConfig(heroId: string): HeroCombatServerConfig {
  const resolved = HERO_COMBAT_CONFIG_BY_ID[heroId as HeroCombatServerConfig["id"]];
  return resolved ?? HERO_COMBAT_CONFIG_BY_ID.user;
}
