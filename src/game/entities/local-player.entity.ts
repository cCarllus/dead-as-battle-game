// Responsável por construir a entidade visual do jogador local na partida global.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import { createMatchPlayerEntity, type MatchPlayerEntity } from "./player.entity";

export function createLocalPlayerEntity(scene: Scene, player: MatchPlayerState): MatchPlayerEntity {
  return createMatchPlayerEntity({
    scene,
    player,
    accentColorHex: "#facc15",
    labelColorHex: "#fde68a"
  });
}
