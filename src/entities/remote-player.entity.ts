// Responsável por construir a entidade visual de jogadores remotos na partida global.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "@/app/models/match-player.model";
import { createMatchPlayerEntity, type MatchPlayerEntity } from "./player.entity";

export function createRemotePlayerEntity(scene: Scene, player: MatchPlayerState): MatchPlayerEntity {
  return createMatchPlayerEntity({
    scene,
    player,
    accentColorHex: "#38bdf8",
    labelColorHex: "#e0f2fe"
  });
}
