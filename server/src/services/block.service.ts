// Isola regras de bloqueio para manter o fluxo de combate desacoplado da Room.
import type { MatchPlayerState } from "../models/match-player.model.js";
import { endBlock as endBlockAction, startBlock as startBlockAction } from "./block-guard.service.js";

export function startBlock(player: MatchPlayerState, now: number): boolean {
  return startBlockAction(player, now);
}

export function endBlock(player: MatchPlayerState): boolean {
  return endBlockAction(player);
}
