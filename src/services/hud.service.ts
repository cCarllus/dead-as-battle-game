// Responsável por transformar estado autoritativo do jogador em dados prontos para renderização no HUD.
import {
  DEFAULT_CHAMPION_ID,
  getBaseChampionById,
  isChampionId
} from "../data/champions.catalog";
import type { MatchPlayerState } from "../models/match-player.model";

const DEFAULT_HERO_LABEL = "HERO";
const DEFAULT_MAX_HEALTH = 1000;
const DEFAULT_ULTIMATE_MAX = 100;

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
  healthCurrent: number;
  healthMax: number;
  healthPercent: number;
  ultimateCharge: number;
  ultimateMax: number;
  ultimatePercent: number;
  isUltimateReady: boolean;
};

export function resolveCombatHudState(player: MatchPlayerState | null): CombatHudState {
  if (!player) {
    return {
      heroLabel: DEFAULT_HERO_LABEL,
      heroCardImageUrl: resolveHeroCardImage(null),
      healthCurrent: DEFAULT_MAX_HEALTH,
      healthMax: DEFAULT_MAX_HEALTH,
      healthPercent: 100,
      ultimateCharge: 0,
      ultimateMax: DEFAULT_ULTIMATE_MAX,
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
    healthCurrent,
    healthMax,
    healthPercent,
    ultimateCharge,
    ultimateMax,
    ultimatePercent,
    isUltimateReady: player.isUltimateReady || ultimateCharge >= ultimateMax
  };
}
