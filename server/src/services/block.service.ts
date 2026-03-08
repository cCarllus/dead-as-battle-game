// Isola regras de bloqueio para manter o fluxo de combate desacoplado da Room.
import type { MatchPlayerState } from "../models/match-player.model.js";
import { handleBlockEnd as endBlockAction, handleBlockStart as startBlockAction } from "./combat.service.js";

export function startBlock(player: MatchPlayerState, now: number): boolean {
  return startBlockAction(player, now);
}

export function endBlock(player: MatchPlayerState): boolean {
  return endBlockAction(player);
}
