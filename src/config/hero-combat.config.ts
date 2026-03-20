// Responsável por centralizar atributos de combate e kit de habilidades por herói no cliente.
import { DEFAULT_CHAMPION_ID, getBaseChampionById, isChampionId } from "@/shared/champions/champions.catalog";
import type { ChampionId } from "@/shared/champions/champion.model";

export type HeroSkillSlotConfig = {
  key: string;
  icon: string;
  name: string;
};

export type HeroCombatClientConfig = {
  id: ChampionId;
  maxHealth: number;
  ultimateMax: number;
  skillThemeColor: `#${string}`;
  skills: {
    primary: HeroSkillSlotConfig;
    secondary: HeroSkillSlotConfig;
    tertiary: HeroSkillSlotConfig;
    utility: HeroSkillSlotConfig;
    ultimate: HeroSkillSlotConfig;
  };
};

type HeroCombatBaseConfig = Omit<HeroCombatClientConfig, "skillThemeColor">;

const HERO_COMBAT_BASE_CONFIG_BY_ID: Record<ChampionId, HeroCombatBaseConfig> = {
  default_champion: {
    id: "default_champion",
    maxHealth: 1000,
    ultimateMax: 100,
    skills: {
      primary: { key: "1", icon: "FB", name: "Fireball" },
      secondary: { key: "2", icon: "KS", name: "Kick Skill" },
      tertiary: { key: "3", icon: "RK", name: "Repeat Kick" },
      utility: { key: "4", icon: "SP", name: "Spell" },
      ultimate: { key: "5", icon: "UT", name: "Ultimate" }
    }
  }
};

export function resolveHeroCombatClientConfig(heroId: string): HeroCombatClientConfig {
  const resolvedHeroId = isChampionId(heroId) ? heroId : DEFAULT_CHAMPION_ID;
  const base = HERO_COMBAT_BASE_CONFIG_BY_ID[resolvedHeroId] ?? HERO_COMBAT_BASE_CONFIG_BY_ID.default_champion;

  return {
    ...base,
    skillThemeColor: getBaseChampionById(base.id).themeColor
  };
}
