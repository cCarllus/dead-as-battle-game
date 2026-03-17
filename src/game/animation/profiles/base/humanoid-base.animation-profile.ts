// Responsável por definir o perfil base de animação compartilhado entre heróis humanoides.
import type { HeroAnimationConfig } from "../../animation-types";

export const BASE_HUMANOID_ANIMATION_PROFILE: HeroAnimationConfig = {
  heroId: "__base_humanoid__",
  embeddedCommandToGroupName: {},
  overrideAssetByCommand: {},
  loopedCommands: ["idle", "walk", "run", "inAir", "ledgeHang", "block"],
  allowEmbeddedFallback: true
};
