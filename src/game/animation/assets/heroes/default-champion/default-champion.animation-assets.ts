// Responsável por mapear os assets externos específicos do default_champion.
import type { AnimationAssetCommandMap } from "../../../animation-types";

export const DEFAULT_CHAMPION_ANIMATION_ASSETS: AnimationAssetCommandMap = {
  fireball: {
    fileName: "fireball.glb",
    groupName: "fireball"
  },
  kickSkill: {
    fileName: "kick-skill.glb",
    groupName: "kick-two"
  },
  repeatKick: {
    fileName: "reapet-kick.glb",
    groupName: "kick-one"
  },
  spell: {
    fileName: "spell.glb",
    groupName: "spell"
  },
  ultimate: {
    fileName: "ultimate.glb",
    groupName: "ultimate"
  }
};
