// Responsável por resolver configuração de animações por herói com fallback seguro.
import { DEFAULT_CHAMPION_ID } from "@/app/data/champions.catalog";
import { DEFAULT_CHAMPION_ANIMATION_PROFILE } from "./profiles/heroes/default-champion/default-champion.animation-profile";
import { normalizeHeroAnimationConfig } from "./animation-overrides";
import type { HeroAnimationConfig } from "./animation-types";

const warnedHeroIdsWithoutConfig = new Set<string>();

const HERO_ANIMATION_CONFIG_BY_ID = new Map<string, HeroAnimationConfig>([
  [DEFAULT_CHAMPION_ANIMATION_PROFILE.heroId, DEFAULT_CHAMPION_ANIMATION_PROFILE]
]);

export function resolveHeroAnimationConfig(heroId: string): HeroAnimationConfig {
  const directConfig = HERO_ANIMATION_CONFIG_BY_ID.get(heroId);
  if (directConfig) {
    return normalizeHeroAnimationConfig(directConfig);
  }

  if (!warnedHeroIdsWithoutConfig.has(heroId)) {
    warnedHeroIdsWithoutConfig.add(heroId);
    console.warn(
      `[animation] Missing animation config for hero '${heroId}'. Falling back to '${DEFAULT_CHAMPION_ID}'.`
    );
  }

  const fallbackConfig =
    HERO_ANIMATION_CONFIG_BY_ID.get(DEFAULT_CHAMPION_ID) ?? DEFAULT_CHAMPION_ANIMATION_PROFILE;
  return normalizeHeroAnimationConfig(fallbackConfig);
}
