// Responsável por expor a view local como especialização da view de player com root autoritativo de gameplay.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "@/app/models/match-player.model";
import { createRemotePlayerView, type RemotePlayerView } from "./remote-player.view";

export type LocalPlayerView = RemotePlayerView;

export function createLocalPlayerView(scene: Scene, player: MatchPlayerState): LocalPlayerView {
  return createRemotePlayerView({
    scene,
    player,
    role: "local",
    visualStyle: {
      accentColorHex: "#facc15",
      labelColorHex: "#fde68a"
    }
  });
}
