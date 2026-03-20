// Responsável por manter o lock da borda ativa, aplicar cooldown de regrab e expor o transform travado de hang.
import type { CharacterLedgeConfig } from "../character/character-config";
import type { LedgeGrabCandidate } from "./ledge-detection-system";

export type LedgeHangSystem = {
  canGrab: (nowMs: number) => boolean;
  grab: (ledge: LedgeGrabCandidate, nowMs: number) => boolean;
  getActiveLedge: () => LedgeGrabCandidate | null;
  getLockedTransform: () => { x: number; y: number; z: number; rotationY: number } | null;
  consumeForClimb: (nowMs: number) => LedgeGrabCandidate | null;
  release: (nowMs: number) => void;
  reset: () => void;
};

export function createLedgeHangSystem(config: CharacterLedgeConfig): LedgeHangSystem {
  let activeLedge: LedgeGrabCandidate | null = null;
  let regrabLockedUntilMs = 0;

  const applyRegrabCooldown = (nowMs: number): void => {
    regrabLockedUntilMs = nowMs + config.regrabCooldownMs;
  };

  return {
    canGrab: (nowMs) => {
      return activeLedge === null && nowMs >= regrabLockedUntilMs;
    },
    grab: (ledge, nowMs) => {
      if (nowMs < regrabLockedUntilMs) {
        return false;
      }

      activeLedge = ledge;
      return true;
    },
    getActiveLedge: () => activeLedge,
    getLockedTransform: () => {
      if (!activeLedge) {
        return null;
      }

      return {
        x: activeLedge.hangPosition.x,
        y: activeLedge.hangPosition.y,
        z: activeLedge.hangPosition.z,
        rotationY: activeLedge.rotationY
      };
    },
    consumeForClimb: (nowMs) => {
      if (!activeLedge) {
        return null;
      }

      const consumed = activeLedge;
      activeLedge = null;
      applyRegrabCooldown(nowMs);
      return consumed;
    },
    release: (nowMs) => {
      activeLedge = null;
      applyRegrabCooldown(nowMs);
    },
    reset: () => {
      activeLedge = null;
      regrabLockedUntilMs = 0;
    }
  };
}
