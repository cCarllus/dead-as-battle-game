// Responsável por definir a biblioteca compartilhada de animações-base usada por personagens humanoides.
import type { HeroAnimationCommandMap } from "./animation-types";

export const SHARED_LOCOMOTION_ANIMATION_LIBRARY: Readonly<HeroAnimationCommandMap> = {
  idle: "idle",
  walk: "walk",
  walkBack: "walk_back",
  walkLeft: "walk_left",
  walkRight: "walk_right",
  run: "run",
  runBack: "run_back",
  runLeft: "run_left",
  runRight: "run_right",
  jump: "jump",
  jumpStart: "jump_start",
  inAir: "jump_loop",
  fallLoop: "fall_loop",
  land: "jump_land",
  crouchIdle: "crouch_idle",
  crouchWalk: "crouch_walk",
  slideStart: "slide_start",
  slideLoop: "slide_loop",
  slideEnd: "slide_end",
  wallRun: "wall_run",
  doubleJump: "double_jump",
  runStop: "run_stop",
  turnLeft: "turn_left",
  turnRight: "turn_right",
  death: "death",
  ultimate: "ultimate",
  attack1: "attack_1",
  attack2: "attack_2",
  attack3: "attack_3",
  block: "block",
  hit: "hit"
};

