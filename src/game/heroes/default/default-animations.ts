// Responsável por mapear comandos de animação padrão para os nomes reais dos clips do herói default.
import type { HeroAnimationConfig } from "../../animation/animation-types";

export const DEFAULT_HERO_ANIMATION_CONFIG: HeroAnimationConfig = {
  heroId: "user",
  commandToGroupName: {
    idle: "Walk_Backward",
    walk: "Regular_Jump",
    walkBack: "Idle_5",
    walkLeft: "Running",
    walkRight: "Skill_01",
    run: "ForwardLeft_Run_Fight",
    jump: "Walking",
    ultimate: "ForwardRight_Run_Fight",
    attack1: "Skill_01",
    attack2: "Skill_01",
    attack3: "Skill_01",
    block: "Idle_5",
    hit: "Regular_Jump"
  },
  loopedCommands: ["idle", "walk", "walkBack", "walkLeft", "walkRight", "run", "block"]
};
