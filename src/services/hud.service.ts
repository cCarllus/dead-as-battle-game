// Responsável por transformar estado autoritativo do jogador em dados prontos para renderização no HUD.
import {
  DEFAULT_CHAMPION_ID,
  getBaseChampionById,
  isChampionId
} from "../data/champions.catalog";
import { resolveHeroCombatClientConfig, type HeroSkillSlotConfig } from "../game/config/hero-combat.config";
import type { MatchPlayerState } from "../models/match-player.model";

const DEFAULT_HERO_LABEL = "HERO";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHeroLabel(heroId: string | null): string {
  if (!heroId) {
    return DEFAULT_HERO_LABEL;
  }

  const normalized = heroId.trim();
  if (!normalized) {
    return DEFAULT_HERO_LABEL;
  }

  if (normalized === "kaiju_no_8") {
    return "KAIJU NO. 8";
  }

  return normalized.replace(/_/g, " ").toUpperCase();
}

function resolveHeroCardImage(heroId: string | null): string {
  const resolvedChampionId = heroId && isChampionId(heroId) ? heroId : DEFAULT_CHAMPION_ID;
  return getBaseChampionById(resolvedChampionId).cardImageUrl;
}

export type CombatHudState = {
  heroLabel: string;
  heroCardImageUrl: string;
  skillThemeColor: `#${string}`;
  skills: {
    primary: HeroSkillSlotConfig;
    secondary: HeroSkillSlotConfig;
    ultimate: HeroSkillSlotConfig;
  };
  healthCurrent: number;
  healthMax: number;
  healthPercent: number;
  ultimateCharge: number;
  ultimateMax: number;
  ultimatePercent: number;
  isUltimateReady: boolean;
};

export function resolveCombatHudState(player: MatchPlayerState | null): CombatHudState {
  const heroCombatConfig = resolveHeroCombatClientConfig(player?.heroId ?? DEFAULT_CHAMPION_ID);

  if (!player) {
    return {
      heroLabel: DEFAULT_HERO_LABEL,
      heroCardImageUrl: resolveHeroCardImage(null),
      skillThemeColor: heroCombatConfig.skillThemeColor,
      skills: heroCombatConfig.skills,
      healthCurrent: heroCombatConfig.maxHealth,
      healthMax: heroCombatConfig.maxHealth,
      healthPercent: 100,
      ultimateCharge: 0,
      ultimateMax: heroCombatConfig.ultimateMax,
      ultimatePercent: 0,
      isUltimateReady: false
    };
  }

  const healthMax = Math.max(1, Math.floor(player.maxHealth));
  const healthCurrent = clamp(Math.floor(player.currentHealth), 0, healthMax);
  const ultimateMax = Math.max(1, Math.floor(player.ultimateMax));
  const ultimateCharge = clamp(Math.floor(player.ultimateCharge), 0, ultimateMax);
  const healthPercent = Math.round((healthCurrent / healthMax) * 100);
  const ultimatePercent = Math.round((ultimateCharge / ultimateMax) * 100);

  return {
    heroLabel: normalizeHeroLabel(player.heroId),
    heroCardImageUrl: resolveHeroCardImage(player.heroId),
    skillThemeColor: heroCombatConfig.skillThemeColor,
    skills: heroCombatConfig.skills,
    healthCurrent,
    healthMax,
    healthPercent,
    ultimateCharge,
    ultimateMax,
    ultimatePercent,
    isUltimateReady: player.isUltimateReady || ultimateCharge >= ultimateMax
  };
}
