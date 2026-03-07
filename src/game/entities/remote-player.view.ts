// Responsável por encapsular a visualização de um jogador remoto com root transform único.
import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import { createMatchPlayerEntity, type MatchPlayerEntity } from "./player.entity";

export type RemotePlayerView = {
  sessionId: string;
  rootNode: TransformNode;
  characterMesh: TransformNode;
  nameplateMesh: AbstractMesh;
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
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
};

export function createRemotePlayerView(options: CreateRemotePlayerViewOptions): RemotePlayerView {
  const entity: MatchPlayerEntity = createMatchPlayerEntity({
    scene: options.scene,
    player: options.player,
    accentColorHex: options.accentColorHex,
    labelColorHex: options.labelColorHex,
    labelPrefix: options.labelPrefix
  });

  entity.setTransform(toTransform(options.player));

  const updateFromState = (player: MatchPlayerState): void => {
    const transform = toTransform(player);
    entity.setTransform(transform);
    view.lastKnownPosition = {
      x: transform.x,
      y: transform.y,
      z: transform.z
    };
    view.lastKnownRotationY = transform.rotationY;
  };

  const view: RemotePlayerView = {
    sessionId: options.player.sessionId,
    rootNode: entity.rootNode,
    characterMesh: entity.characterNode,
    nameplateMesh: entity.nameplateNode,
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
