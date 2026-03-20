// Responsável por mapear os assets externos específicos do default_champion.
import type { AnimationAssetCommandMap } from "../../../animation-types";
import { HERO_ANIMATION_ASSET_URLS } from "@/shared/assets/game-assets";

export const DEFAULT_CHAMPION_ANIMATION_ASSETS: AnimationAssetCommandMap = {
  fireball: {
    assetUrl: HERO_ANIMATION_ASSET_URLS.defaultChampion.fireball,
    fileName: "fireball.glb",
    groupName: "fireball"
  },
  kickSkill: {
    assetUrl: HERO_ANIMATION_ASSET_URLS.defaultChampion.kickSkill,
    fileName: "kick-skill.glb",
    groupName: "kick-two"
  },
  repeatKick: {
    assetUrl: HERO_ANIMATION_ASSET_URLS.defaultChampion.repeatKick,
    fileName: "reapet-kick.glb",
    groupName: "kick-one"
  },
  spell: {
    assetUrl: HERO_ANIMATION_ASSET_URLS.defaultChampion.spell,
    fileName: "spell.glb",
    groupName: "spell"
  },
  ultimate: {
    assetUrl: HERO_ANIMATION_ASSET_URLS.defaultChampion.ultimate,
    fileName: "ultimate.glb",
    groupName: "ultimate"
  }
};
