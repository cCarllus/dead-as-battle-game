// Responsável por consumir eventos autoritativos de combate e disparar feedback visual (números de dano) no cliente.
import type {
  MatchCombatBlockPayload,
  MatchCombatHitPayload,
  MatchCombatGuardBreakPayload
} from "../../models/match-player.model";
import type { MatchService } from "../../services/match.service";
import type { DamageNumberEffect } from "../../ui/effects/damage-number.effect";

export type CombatFeedbackSystem = {
  dispose: () => void;
};

export type CreateCombatFeedbackSystemOptions = {
  matchService: MatchService;
  damageNumbers: DamageNumberEffect;
  resolveScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  onHitConfirmed?: (payload: MatchCombatHitPayload) => void;
  onBlockConfirmed?: (payload: MatchCombatBlockPayload) => void;
  onGuardBreakConfirmed?: (payload: MatchCombatGuardBreakPayload) => void;
};

export function createCombatFeedbackSystem(options: CreateCombatFeedbackSystemOptions): CombatFeedbackSystem {
  const disposeHit = options.matchService.onCombatHit((payload) => {
    options.onHitConfirmed?.(payload);

    if (payload.damage <= 0) {
      return;
    }

    const position = options.resolveScreenPosition(payload.targetSessionId);
    if (!position) {
      return;
    }

    options.damageNumbers.show({
      value: payload.damage,
      x: position.x,
      y: position.y,
      wasBlocked: payload.wasBlocked
    });
  });

  const disposeBlock = options.matchService.onCombatBlock((payload) => {
    options.onBlockConfirmed?.(payload);
  });

  const disposeGuardBreak = options.matchService.onCombatGuardBreak((payload) => {
    options.onGuardBreakConfirmed?.(payload);
  });

  return {
    dispose: () => {
      disposeHit();
      disposeBlock();
      disposeGuardBreak();
    }
  };
}
