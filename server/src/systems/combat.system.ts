// Sistema de combate: processa intents de ataque, skills, bloqueio e progressão autoritativa das fases de combate.
import type {
  CombatBlockEventPayload,
  CombatGuardBreakEventPayload,
  CombatHitEventPayload,
  CombatKillEventPayload,
  CombatPlayerDiedEventPayload,
  CombatRagdollEventPayload,
  CombatUltimateEventPayload,
  MatchAttackStartedEventPayload,
  MatchBlockEndedEventPayload,
  MatchBlockStartedEventPayload,
  MatchPlayerState,
  MatchSkillCastFinishedEventPayload,
  MatchSkillCastStartedEventPayload
} from "../models/match-player.model.js";
import { createCombatController, type CombatController } from "../combat/combat-controller.js";

export type CombatSystemResult = {
  didChangeState: boolean;
  combatStateChangedPlayers: MatchPlayerState[];
  attackStartedEvents: MatchAttackStartedEventPayload[];
  blockStartedEvents: MatchBlockStartedEventPayload[];
  blockEndedEvents: MatchBlockEndedEventPayload[];
  hitEvents: CombatHitEventPayload[];
  blockEvents: CombatBlockEventPayload[];
  guardBreakEvents: CombatGuardBreakEventPayload[];
  killEvents: CombatKillEventPayload[];
  skillCastStartedEvents: MatchSkillCastStartedEventPayload[];
  skillCastFinishedEvents: MatchSkillCastFinishedEventPayload[];
  deathEvents: CombatPlayerDiedEventPayload[];
  ragdollEvents: CombatRagdollEventPayload[];
  ultimateEvents: CombatUltimateEventPayload[];
};

export type CombatSystem = {
  update: (deltaSeconds: number, now: number) => CombatSystemResult;
  queueAttackStart: (sessionId: string) => void;
  queueSkillCast: (sessionId: string, slot: 1 | 2 | 3 | 4 | 5) => void;
  queueBlockStart: (sessionId: string) => void;
  queueBlockEnd: (sessionId: string) => void;
  clearPlayer: (sessionId: string) => void;
};

export function createCombatSystem(options: {
  players: () => Record<string, MatchPlayerState>;
}): CombatSystem {
  const controller: CombatController = createCombatController(options);

  return {
    update: (deltaSeconds, now) => controller.update(deltaSeconds, now),
    queueAttackStart: controller.queueAttackStart,
    queueSkillCast: controller.queueSkillCast,
    queueBlockStart: controller.queueBlockStart,
    queueBlockEnd: controller.queueBlockEnd,
    clearPlayer: controller.clearPlayer
  };
}
