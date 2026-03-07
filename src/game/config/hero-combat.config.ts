// Responsável por centralizar atributos de combate e kit de habilidades por herói no cliente.
import { DEFAULT_CHAMPION_ID, getBaseChampionById, isChampionId } from "../../data/champions.catalog";
import type { ChampionId } from "../../models/champion.model";

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
    ultimate: HeroSkillSlotConfig;
  };
};

type HeroCombatBaseConfig = Omit<HeroCombatClientConfig, "skillThemeColor">;

const HERO_COMBAT_BASE_CONFIG_BY_ID: Record<ChampionId, HeroCombatBaseConfig> = {
  user: {
    id: "user",
    maxHealth: 1000,
    ultimateMax: 100,
    skills: {
      primary: { key: "1", icon: "ST", name: "Strike" },
      secondary: { key: "2", icon: "DS", name: "Dash" },
      ultimate: { key: "G", icon: "OV", name: "Overdrive" }
    }
  },
  sukuna: {
    id: "sukuna",
    maxHealth: 900,
    ultimateMax: 100,
    skills: {
      primary: { key: "1", icon: "DI", name: "Dismantle" },
      secondary: { key: "2", icon: "CL", name: "Cleave" },
      ultimate: { key: "G", icon: "MS", name: "Malevolent Shrine" }
    }
  },
  kaiju_no_8: {
    id: "kaiju_no_8",
    maxHealth: 1400,
    ultimateMax: 100,
    skills: {
      primary: { key: "1", icon: "CL", name: "Claw Rush" },
      secondary: { key: "2", icon: "SR", name: "Sonic Roar" },
      ultimate: { key: "G", icon: "KB", name: "Kaiju Burst" }
    }
  }
};

export function resolveHeroCombatClientConfig(heroId: string): HeroCombatClientConfig {
  const resolvedHeroId = isChampionId(heroId) ? heroId : DEFAULT_CHAMPION_ID;
  const base = HERO_COMBAT_BASE_CONFIG_BY_ID[resolvedHeroId] ?? HERO_COMBAT_BASE_CONFIG_BY_ID.user;

  return {
    ...base,
    skillThemeColor: getBaseChampionById(base.id).themeColor
  };
}
