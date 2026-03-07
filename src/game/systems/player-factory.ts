// Responsável por criar players com hierarquia fixa gameplayRoot/collisionBody/visualRoot/nameplate.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { PlayerVisualStyle } from "../entities/player.entity";
import type { LocalPlayerView } from "../entities/local-player.view";
import {
  createRemotePlayerView,
  type PlayerViewRole,
  type RemotePlayerView
} from "../entities/remote-player.view";

type PlayerRole = PlayerViewRole;

function resolveVisualStyle(role: PlayerRole): PlayerVisualStyle {
  if (role === "local") {
    return {
      accentColorHex: "#facc15",
      labelColorHex: "#fde68a"
    };
  }

  if (role === "teammate") {
    return {
      accentColorHex: "#60a5fa",
      labelColorHex: "#bfdbfe",
      labelPrefix: "● "
    };
  }

  return {
    accentColorHex: "#fb7185",
    labelColorHex: "#fecdd3"
  };
}

export type PlayerFactory = {
  createPlayer: (player: MatchPlayerState, role: PlayerRole) => RemotePlayerView;
  createLocalPlayerView: (player: MatchPlayerState) => LocalPlayerView;
  createRemotePlayerView: (player: MatchPlayerState, role: "teammate" | "enemy") => RemotePlayerView;
};

export function createPlayerFactory(scene: Scene): PlayerFactory {
  const createPlayer = (player: MatchPlayerState, role: PlayerRole): RemotePlayerView => {
    return createRemotePlayerView({
      scene,
      player,
      role,
      visualStyle: resolveVisualStyle(role)
    });
  };

  return {
    createPlayer,
    createLocalPlayerView: (player) => {
      return createPlayer(player, "local") as LocalPlayerView;
    },
    createRemotePlayerView: (player, role) => {
      return createPlayer(player, role);
    }
  };
}
