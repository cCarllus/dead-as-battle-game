// Responsável por criar PlayerViews com instâncias visuais totalmente independentes por sessionId.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import { createMatchPlayerEntity } from "../entities/player.entity";
import type { LocalPlayerView } from "../entities/local-player.view";
import type { RemotePlayerView } from "../entities/remote-player.view";

type PlayerRole = "local" | "teammate" | "enemy";

function createBaseView(player: MatchPlayerState, entity: ReturnType<typeof createMatchPlayerEntity>): RemotePlayerView {
  entity.setTransform({
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY
  });

  const view: RemotePlayerView = {
    sessionId: player.sessionId,
    rootNode: entity.rootNode,
    characterMesh: entity.characterNode,
    nameplateMesh: entity.nameplateNode,
    lastKnownPosition: {
      x: player.x,
      y: player.y,
      z: player.z
    },
    lastKnownRotationY: player.rotationY,
    updateFromState: (nextPlayer) => {
      entity.setTransform({
        x: nextPlayer.x,
        y: nextPlayer.y,
        z: nextPlayer.z,
        rotationY: nextPlayer.rotationY
      });

      view.lastKnownPosition = {
        x: nextPlayer.x,
        y: nextPlayer.y,
        z: nextPlayer.z
      };
      view.lastKnownRotationY = nextPlayer.rotationY;
    },
    getTransform: () => {
      return entity.getTransform();
    },
    getCameraTarget: () => {
      const target = entity.getCameraTarget();
      return {
        x: target.x,
        y: target.y,
        z: target.z
      };
    },
    dispose: () => {
      entity.dispose();
    }
  };

  return view;
}

function resolveVisualStyle(role: PlayerRole): {
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
} {
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
  createLocalPlayerView: (player: MatchPlayerState) => LocalPlayerView;
  createRemotePlayerView: (player: MatchPlayerState, role: "teammate" | "enemy") => RemotePlayerView;
};

export function createPlayerFactory(scene: Scene): PlayerFactory {
  const createView = (player: MatchPlayerState, role: PlayerRole): RemotePlayerView => {
    const visualStyle = resolveVisualStyle(role);

    const entity = createMatchPlayerEntity({
      scene,
      player,
      accentColorHex: visualStyle.accentColorHex,
      labelColorHex: visualStyle.labelColorHex,
      labelPrefix: visualStyle.labelPrefix,
      forceFallbackOnly: true
    });

    return createBaseView(player, entity);
  };

  return {
    createLocalPlayerView: (player) => {
      return createView(player, "local") as LocalPlayerView;
    },
    createRemotePlayerView: (player, role) => {
      return createView(player, role);
    }
  };
}
