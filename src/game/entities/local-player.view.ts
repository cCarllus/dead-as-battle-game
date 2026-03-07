// Responsável por encapsular a visualização do jogador local com root transform único e consistente.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import { createRemotePlayerView, type RemotePlayerView } from "./remote-player.view";

export type LocalPlayerView = RemotePlayerView;

export function createLocalPlayerView(scene: Scene, player: MatchPlayerState): LocalPlayerView {
  return createRemotePlayerView({
    scene,
    player,
    accentColorHex: "#facc15",
    labelColorHex: "#fde68a"
  });
}
