// Sistema de regeneração/passivos periódicos (ex.: carga de ultimate).
import type { MatchPlayerState } from "../models/match-player.model.js";
import { addUltimateCharge } from "../services/ultimate.service.js";

const ULTIMATE_AUTO_CHARGE_INTERVAL_MS = 2000;
const ULTIMATE_AUTO_CHARGE_AMOUNT = 5;

export type RegenerationSystemResult = {
  didChangeState: boolean;
};

export type RegenerationSystem = {
  update: (now: number) => RegenerationSystemResult;
};

export function createRegenerationSystem(options: {
  players: () => Record<string, MatchPlayerState>;
}): RegenerationSystem {
  let lastUltimateChargeAt = Date.now();

  return {
    update: (now) => {
      if (now - lastUltimateChargeAt < ULTIMATE_AUTO_CHARGE_INTERVAL_MS) {
        return { didChangeState: false };
      }

      lastUltimateChargeAt = now;
      let didChangeState = false;
      Object.values(options.players()).forEach((player) => {
        if (!player.isAlive) {
          return;
        }

        const previousUltimateCharge = player.ultimateCharge;
        const previousUltimateReady = player.isUltimateReady;
        addUltimateCharge(player, ULTIMATE_AUTO_CHARGE_AMOUNT);

        if (
          player.ultimateCharge !== previousUltimateCharge ||
          player.isUltimateReady !== previousUltimateReady
        ) {
          didChangeState = true;
        }
      });

      return { didChangeState };
    }
  };
}
