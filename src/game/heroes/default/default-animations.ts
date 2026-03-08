// Responsável por mapear comandos de animação padrão para os nomes reais dos clips do herói default.
import type { HeroAnimationConfig } from "../../animation/animation-types";

export const DEFAULT_HERO_ANIMATION_CONFIG: HeroAnimationConfig = {
  heroId: "user",
  commandToGroupName: {
    idle: "ForwardRight_Run_Fight",
    walk: "Regular_Jump",
    walkBack: "Walking",
    walkLeft: "Running",
    walkRight: "ForwardLeft_Run_Fight",
    run: "Sword_Parry",
    jump: "Skill_01",
    ultimate: "Walk_Backward",
    attack1: "Charged_Slash",
    attack2: "Idle_5",
    attack3: "Left_Hook_from_Guard",
    block: "Left_Jab_from_Guard",
    hit: "Walking"
  },
  loopedCommands: ["idle", "walk", "walkBack", "walkLeft", "walkRight", "run", "block"]
};
