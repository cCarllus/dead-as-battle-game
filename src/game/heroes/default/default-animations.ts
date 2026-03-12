// Responsável por mapear comandos de animação padrão para os nomes reais dos clips do herói default.
import type { HeroAnimationConfig } from "../../animation/animation-types";

export const DEFAULT_HERO_ANIMATION_CONFIG: HeroAnimationConfig = {
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
    block: "Hit_Reaction_1",
    hit: "Left_Hook_from_Guard"
  },
  loopedCommands: ["idle", "walk", "run", "inAir", "ledgeHang", "block"]
};
