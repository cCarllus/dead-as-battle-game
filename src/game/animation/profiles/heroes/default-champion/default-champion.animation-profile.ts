// Responsável por definir o perfil final de animação do default_champion a partir do perfil base.
import { DEFAULT_CHAMPION_ANIMATION_ASSETS } from "../../../assets/heroes/default-champion/default-champion.animation-assets";
import { createHeroAnimationConfig } from "../../profile-utils";
import { BASE_HUMANOID_ANIMATION_PROFILE } from "../../base/humanoid-base.animation-profile";
import type { HeroAnimationConfig } from "../../../animation-types";

export const DEFAULT_CHAMPION_ANIMATION_PROFILE: HeroAnimationConfig = createHeroAnimationConfig(
  BASE_HUMANOID_ANIMATION_PROFILE,
  {
    heroId: "default_champion",
    embeddedCommandToGroupName: {
      idle: "Left_Jab_from_Guard",
      walk: "Skill_01",
      run: "ForwardRight_Run_Fight",
      jump: "ForwardLeft_Run_Fight",
      inAir: "ForwardLeft_Run_Fight",
      rolling: "Regular_Jump",
      death: "Walk_Backward",
      ultimate: "Regular_Jump",
      attack1: "Charged_Slash",
      attack2: "Dead",
      attack3: "Sword_Parry",
      fireball: "Regular_Jump",
      kickSkill: "Sword_Parry",
      repeatKick: "Sword_Parry",
      spell: "Regular_Jump",
      block: "Hit_Reaction_1",
      hit: "Left_Hook_from_Guard"
    },
    overrideAssetByCommand: DEFAULT_CHAMPION_ANIMATION_ASSETS
  }
);
