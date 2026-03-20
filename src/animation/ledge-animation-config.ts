// Responsável por centralizar os assets compartilhados usados pelos estados de ledge hang e climb.
import type { AnimationAssetCommandMap } from "./animation-types";
import { SHARED_ANIMATION_ASSET_URLS } from "@/shared/assets/game-assets";

export const LEDGE_ANIMATION_ASSET_BY_COMMAND: Readonly<AnimationAssetCommandMap> = {
  ledgeHang: {
    assetUrl: SHARED_ANIMATION_ASSET_URLS.wallHangingIdle,
    fileName: "wall-hanging-idle.glb",
    stripPositionTracks: true
  },
  ledgeClimb: {
    assetUrl: SHARED_ANIMATION_ASSET_URLS.upWall,
    fileName: "up-wall.glb",
    stripPositionTracks: true
  }
};
