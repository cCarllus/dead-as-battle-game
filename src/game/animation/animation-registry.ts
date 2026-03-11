// Responsável por resolver configuração de animações por herói com fallback seguro.
import { DEFAULT_CHAMPION_ID } from "../../data/champions.catalog";
import { DEFAULT_HERO_ANIMATION_CONFIG } from "../heroes/default/default-animations";
import { STEVE_HERO_ANIMATION_CONFIG } from "../heroes/steve/steve-animations";
import { SUKUNA_HERO_ANIMATION_CONFIG } from "../heroes/sukuna/sukuna-animations";
import { createAnimationConfigWithOverrides } from "./animation-overrides";
import type { HeroAnimationConfig } from "./animation-types";

const warnedHeroIdsWithoutConfig = new Set<string>();

const HERO_ANIMATION_CONFIG_BY_ID = new Map<string, HeroAnimationConfig>([
  [DEFAULT_HERO_ANIMATION_CONFIG.heroId, DEFAULT_HERO_ANIMATION_CONFIG],
  [SUKUNA_HERO_ANIMATION_CONFIG.heroId, SUKUNA_HERO_ANIMATION_CONFIG],
  [STEVE_HERO_ANIMATION_CONFIG.heroId, STEVE_HERO_ANIMATION_CONFIG]
]);

export function resolveHeroAnimationConfig(heroId: string): HeroAnimationConfig {
  const directConfig = HERO_ANIMATION_CONFIG_BY_ID.get(heroId);
  if (directConfig) {
    return createAnimationConfigWithOverrides(directConfig);
  }

  if (!warnedHeroIdsWithoutConfig.has(heroId)) {
    warnedHeroIdsWithoutConfig.add(heroId);
    console.warn(
      `[animation] Missing animation config for hero '${heroId}'. Falling back to '${DEFAULT_CHAMPION_ID}'.`
    );
  }

  const fallbackConfig =
    HERO_ANIMATION_CONFIG_BY_ID.get(DEFAULT_CHAMPION_ID) ?? DEFAULT_HERO_ANIMATION_CONFIG;
  return createAnimationConfigWithOverrides(fallbackConfig);
}
