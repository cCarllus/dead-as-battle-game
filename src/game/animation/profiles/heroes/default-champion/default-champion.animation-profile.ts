// Responsável por definir o perfil final de animação do default_champion a partir do perfil base.
import { DEFAULT_CHAMPION_ANIMATION_ASSETS } from "../../../assets/heroes/default-champion/default-champion.animation-assets";
import { createHeroAnimationConfig } from "../../profile-utils";
import { BASE_HUMANOID_ANIMATION_PROFILE } from "../../base/humanoid-base.animation-profile";
import type { HeroAnimationConfig } from "../../../animation-types";

export const DEFAULT_CHAMPION_ANIMATION_PROFILE: HeroAnimationConfig = createHeroAnimationConfig(
  BASE_HUMANOID_ANIMATION_PROFILE,
  {
    heroId: "default_champion",
    overrideAssetByCommand: DEFAULT_CHAMPION_ANIMATION_ASSETS
  }
);
