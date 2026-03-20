// Responsável por centralizar os assets compartilhados usados pelos estados de ledge hang e climb.
import type { AnimationAssetCommandMap } from "./animation-types";

export const LEDGE_ANIMATION_ASSET_BY_COMMAND: Readonly<AnimationAssetCommandMap> = {
  ledgeHang: {
    fileName: "wall-hanging-idle.glb",
    stripPositionTracks: true
  },
  ledgeClimb: {
    fileName: "up-wall.glb",
    stripPositionTracks: true
  }
};
