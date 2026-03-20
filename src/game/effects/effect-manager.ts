// Responsável por rotear e gerenciar efeitos visuais replicados por personagem/sessionId.
import type { Scene, TransformNode } from "@babylonjs/core";
import {
  playDefaultUltimateEffect,
  type DefaultUltimateEffectHandle
} from "./default-ultimate.effect";

const DEFAULT_HERO_ID = "default_champion";

export type UltimateEffectPayload = {
  sessionId: string;
  characterId: string;
  durationMs: number;
};

export type PlayerEffectAnchor = {
  gameplayRoot: TransformNode;
  visualRoot: TransformNode;
};

export type EffectManager = {
  playUltimateEffect: (payload: UltimateEffectPayload) => void;
  stopEffectsForPlayer: (sessionId: string) => void;
  dispose: () => void;
};

export type CreateEffectManagerOptions = {
  scene: Scene;
  resolvePlayerEffectAnchor: (sessionId: string) => PlayerEffectAnchor | null;
};

export function createEffectManager(options: CreateEffectManagerOptions): EffectManager {
  const defaultUltimateBySessionId = new Map<string, DefaultUltimateEffectHandle>();

  const stopEffectsForPlayer = (sessionId: string): void => {
    const activeEffect = defaultUltimateBySessionId.get(sessionId);
    if (!activeEffect) {
      return;
    }

    defaultUltimateBySessionId.delete(sessionId);
    activeEffect.dispose();
  };

  return {
    playUltimateEffect: (payload) => {
      if (!payload?.sessionId) {
        return;
      }

      if (payload.characterId !== DEFAULT_HERO_ID) {
        return;
      }

      const playerAnchor = options.resolvePlayerEffectAnchor(payload.sessionId);
      if (!playerAnchor) {
        console.warn(
          `[fx] Default ultimate ignored: player anchor not found for session '${payload.sessionId}'.`
        );
        return;
      }

      stopEffectsForPlayer(payload.sessionId);

      let createdEffect: DefaultUltimateEffectHandle | null = null;
      try {
        createdEffect = playDefaultUltimateEffect({
          scene: options.scene,
          sessionId: payload.sessionId,
          gameplayRoot: playerAnchor.gameplayRoot,
          visualRoot: playerAnchor.visualRoot,
          durationMs: payload.durationMs,
          onDisposed: () => {
            const active = defaultUltimateBySessionId.get(payload.sessionId);
            if (active === createdEffect) {
              defaultUltimateBySessionId.delete(payload.sessionId);
            }
          }
        });

        defaultUltimateBySessionId.set(payload.sessionId, createdEffect);
      } catch (error) {
        console.warn(
          `[fx] Failed to create default ultimate effect for session '${payload.sessionId}'.`,
          error
        );
      }
    },
    stopEffectsForPlayer,
    dispose: () => {
      defaultUltimateBySessionId.forEach((effect) => {
        effect.dispose();
      });
      defaultUltimateBySessionId.clear();
    }
  };
}
