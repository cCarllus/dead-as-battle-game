// Responsável por tipar a view de player desacoplada com gameplayRoot autoritativo e camada visual independente.
import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import {
  createMatchPlayerEntity,
  type MatchPlayerEntity,
  type PlayerVisualStyle
} from "./player.entity";

export type PlayerViewRole = "local" | "teammate" | "enemy";

export type RemotePlayerView = {
  sessionId: string;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  visualRoot: TransformNode;
  nameplateNode: AbstractMesh;
  role: PlayerViewRole;
  nickname: string;
  heroId: string;
  lastKnownPosition: { x: number; y: number; z: number };
  lastKnownRotationY: number;
  updateFromState: (player: MatchPlayerState) => void;
  getTransform: () => { x: number; y: number; z: number; rotationY: number };
  getCameraTarget: () => { x: number; y: number; z: number };
  dispose: () => void;
};

function toTransform(player: MatchPlayerState): { x: number; y: number; z: number; rotationY: number } {
  return {
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY
  };
}

export type CreateRemotePlayerViewOptions = {
  scene: Scene;
  player: MatchPlayerState;
  role: PlayerViewRole;
  visualStyle: PlayerVisualStyle;
};

export function createRemotePlayerView(options: CreateRemotePlayerViewOptions): RemotePlayerView {
  const entity: MatchPlayerEntity = createMatchPlayerEntity({
    scene: options.scene,
    player: options.player,
    accentColorHex: options.visualStyle.accentColorHex,
    labelColorHex: options.visualStyle.labelColorHex,
    labelPrefix: options.visualStyle.labelPrefix
  });

  entity.setTransform(toTransform(options.player));

  const updateFromState = (player: MatchPlayerState): void => {
    const transform = toTransform(player);
    entity.setTransform(transform);
    if (view.nickname !== player.nickname) {
      entity.setNickname(player.nickname);
      view.nickname = player.nickname;
    }

    if (view.heroId !== player.heroId) {
      entity.applyHeroConfig(player.heroId);
      view.heroId = player.heroId;
    }

    view.lastKnownPosition = {
      x: transform.x,
      y: transform.y,
      z: transform.z
    };
    view.lastKnownRotationY = transform.rotationY;
  };

  const view: RemotePlayerView = {
    sessionId: options.player.sessionId,
    gameplayRoot: entity.gameplayRoot,
    collisionBody: entity.collisionBody,
    visualRoot: entity.visualRoot,
    nameplateNode: entity.nameplateNode,
    role: options.role,
    nickname: options.player.nickname,
    heroId: options.player.heroId,
    lastKnownPosition: {
      x: options.player.x,
      y: options.player.y,
      z: options.player.z
    },
    lastKnownRotationY: options.player.rotationY,
    updateFromState,
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
