// Responsável por prever localmente fases de ataque/skill para feedback imediato sem assumir autoridade de dano.
import {
  resolveBasicAttackDefinition,
  resolveCombatKitDefinition,
  resolveSkillDefinition
} from "./definitions/combat-kit-registry";
import type { CombatActionDefinition, CombatAttackPhase, CombatRuntimeState } from "./definitions/combat-types";

export type CombatStateMachineConfig = {
  comboResetMs: number;
  blockMaxHoldMs: number;
};

export type CombatStateMachineServerState = {
  heroId: string;
  isAlive: boolean;
  combatState: CombatRuntimeState;
  attackPhase: CombatAttackPhase;
  isAttacking: boolean;
  attackComboIndex: number;
  activeActionId: string;
  activeSkillId: string;
  isBlocking: boolean;
  isGuardBroken: boolean;
  stunUntil: number;
  skillCooldowns: Record<string, number>;
};

export type CombatStateSnapshot = {
  state: CombatRuntimeState;
  attackPhase: CombatAttackPhase;
  comboChainIndex: 0 | 1 | 2 | 3;
  activeAttackComboIndex: 0 | 1 | 2 | 3;
  activeSkillId: string;
  activeActionId: string;
  isBlocking: boolean;
  canQueueNextAttack: boolean;
  canBeInterrupted: boolean;
  canDealDamage: boolean;
  isDead: boolean;
};

export type AttackRequestResult = {
  accepted: boolean;
  comboIndex: 0 | 1 | 2 | 3;
};

export type SkillRequestResult = {
  accepted: boolean;
  skillId: string;
  slot: 1 | 2 | 3 | 4 | 5;
};

export type CombatStateMachine = {
  reset: () => void;
  requestAttack: (nowMs: number, serverState: CombatStateMachineServerState) => AttackRequestResult;
  requestSkill: (
    slot: 1 | 2 | 3 | 4 | 5,
    nowMs: number,
    serverState: CombatStateMachineServerState
  ) => SkillRequestResult;
  requestBlockStart: (nowMs: number, serverState: CombatStateMachineServerState) => boolean;
  requestBlockEnd: () => void;
  step: (nowMs: number, serverState: CombatStateMachineServerState) => CombatStateSnapshot;
  getSnapshot: (nowMs: number, serverState: CombatStateMachineServerState) => CombatStateSnapshot;
};

type PredictedActionRuntime = {
  definition: CombatActionDefinition;
  state: CombatRuntimeState;
  phase: CombatAttackPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  comboIndex: 0 | 1 | 2 | 3;
};

function toComboIndex(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(3, Math.floor(value))) as 1 | 2 | 3;
}

function isCombatStunned(nowMs: number, serverState: CombatStateMachineServerState): boolean {
  return !serverState.isAlive || serverState.isGuardBroken || nowMs < serverState.stunUntil;
}

function isServerActionLocked(serverState: CombatStateMachineServerState): boolean {
  return (
    serverState.combatState === "AttackWindup" ||
    serverState.combatState === "AttackActive" ||
    serverState.combatState === "AttackRecovery" ||
    serverState.combatState === "SkillCast" ||
    serverState.combatState === "HitReact" ||
    serverState.combatState === "Dead"
  );
}

function resolveComboResetMs(
  serverState: CombatStateMachineServerState,
  fallbackMs: number
): number {
  const kit = resolveCombatKitDefinition(serverState.heroId);
  return kit.comboResetTimeMs > 0 ? kit.comboResetTimeMs : fallbackMs;
}

function buildSnapshot(
  serverState: CombatStateMachineServerState,
  predicted: PredictedActionRuntime | null,
  comboChainIndex: 0 | 1 | 2 | 3,
  predictedBlockActive: boolean
): CombatStateSnapshot {
  if (!serverState.isAlive) {
    return {
      state: "Dead",
      attackPhase: "None",
      comboChainIndex: 0,
      activeAttackComboIndex: 0,
      activeSkillId: "",
      activeActionId: "",
      isBlocking: false,
      canQueueNextAttack: false,
      canBeInterrupted: false,
      canDealDamage: false,
      isDead: true
    };
  }

  const predictedActiveAttackComboIndex = predicted?.definition.comboIndex ?? 0;
  const predictedActiveSkillId = predicted?.definition.skillId ?? "";
  const state = predicted?.state ?? serverState.combatState;
  const attackPhase = predicted?.phase ?? serverState.attackPhase;

  return {
    state,
    attackPhase,
    comboChainIndex,
    activeAttackComboIndex:
      predictedActiveAttackComboIndex || (serverState.isAttacking ? toComboIndex(serverState.attackComboIndex) : 0),
    activeSkillId: predictedActiveSkillId || serverState.activeSkillId,
    activeActionId: predicted?.definition.id ?? serverState.activeActionId,
    isBlocking: !predicted && (predictedBlockActive || serverState.isBlocking),
    canQueueNextAttack: !!predicted?.definition.comboIndex && predicted.phase === "Recovery" && predicted.definition.comboQueueWindowMs > 0,
    canBeInterrupted: predicted ? predicted.state !== "AttackActive" : true,
    canDealDamage: attackPhase === "Active",
    isDead: false
  };
}

export function createCombatStateMachine(config: CombatStateMachineConfig): CombatStateMachine {
  let comboChainIndex: 0 | 1 | 2 | 3 = 0;
  let lastAttackAtMs = 0;
  let predictedAction: PredictedActionRuntime | null = null;
  let queuedAttackRequested = false;
  let predictedBlockActive = false;

  const reset = (): void => {
    comboChainIndex = 0;
    lastAttackAtMs = 0;
    predictedAction = null;
    queuedAttackRequested = false;
    predictedBlockActive = false;
  };

  const setPredictedAction = (definition: CombatActionDefinition, nowMs: number, comboIndex: 0 | 1 | 2 | 3): void => {
    predictedBlockActive = false;
    predictedAction = {
      definition,
      state: definition.comboIndex ? "AttackWindup" : "SkillCast",
      phase: "Windup",
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + definition.windupMs,
      comboIndex
    };
  };

  const advancePredictedAction = (nowMs: number, heroId: string): void => {
    if (!predictedAction) {
      return;
    }

    if (nowMs < predictedAction.phaseEndsAt) {
      return;
    }

    if (predictedAction.phase === "Windup") {
      predictedAction.phase = "Active";
      predictedAction.phaseStartedAt = nowMs;
      predictedAction.phaseEndsAt = nowMs + predictedAction.definition.activeMs;
      predictedAction.state = predictedAction.definition.comboIndex ? "AttackActive" : "SkillCast";
      return;
    }

    if (predictedAction.phase === "Active") {
      predictedAction.phase = "Recovery";
      predictedAction.phaseStartedAt = nowMs;
      predictedAction.phaseEndsAt = nowMs + predictedAction.definition.recoveryMs;
      predictedAction.state = predictedAction.definition.comboIndex ? "AttackRecovery" : "SkillCast";
      return;
    }

    if (
      queuedAttackRequested &&
      predictedAction.definition.comboIndex &&
      predictedAction.definition.comboIndex < 3
    ) {
      queuedAttackRequested = false;
      comboChainIndex = ((predictedAction.definition.comboIndex % 3) + 1) as 1 | 2 | 3;
      lastAttackAtMs = nowMs;
      setPredictedAction(resolveBasicAttackDefinition(heroId, comboChainIndex), nowMs, comboChainIndex);
      return;
    }

    predictedAction = null;
  };

  return {
    reset,
    requestAttack: (nowMs, serverState) => {
      if (isCombatStunned(nowMs, serverState) || !serverState.isAlive) {
        return { accepted: false, comboIndex: 0 };
      }

      advancePredictedAction(nowMs, serverState.heroId);
      if (predictedAction) {
        const canQueue =
          predictedAction.definition.kind === "basicAttack" &&
          predictedAction.definition.comboIndex !== undefined &&
          predictedAction.definition.comboIndex < 3 &&
          nowMs >= predictedAction.phaseEndsAt - predictedAction.definition.comboQueueWindowMs;
        if (canQueue) {
          const nextComboIndex = ((predictedAction.definition.comboIndex ?? 1) % 3) + 1;
          queuedAttackRequested = true;
          return {
            accepted: true,
            comboIndex: nextComboIndex as 1 | 2 | 3
          };
        }

        return { accepted: false, comboIndex: 0 };
      }

      if (isServerActionLocked(serverState)) {
        return { accepted: false, comboIndex: 0 };
      }

      const comboResetMs = resolveComboResetMs(serverState, config.comboResetMs);
      const shouldResetCombo = comboChainIndex <= 0 || nowMs - lastAttackAtMs > comboResetMs;
      comboChainIndex = shouldResetCombo ? 1 : (((comboChainIndex % 3) + 1) as 1 | 2 | 3);
      lastAttackAtMs = nowMs;
      setPredictedAction(resolveBasicAttackDefinition(serverState.heroId, comboChainIndex), nowMs, comboChainIndex);

      return {
        accepted: true,
        comboIndex: comboChainIndex
      };
    },
    requestSkill: (slot, nowMs, serverState) => {
      if (isCombatStunned(nowMs, serverState) || !serverState.isAlive) {
        return { accepted: false, skillId: "", slot };
      }

      advancePredictedAction(nowMs, serverState.heroId);
      if (predictedAction || isServerActionLocked(serverState)) {
        return { accepted: false, skillId: "", slot };
      }

      const definition = resolveSkillDefinition(serverState.heroId, slot);
      const cooldownEndsAt = serverState.skillCooldowns[definition.skillId ?? definition.id] ?? 0;
      if (cooldownEndsAt > nowMs) {
        return { accepted: false, skillId: "", slot };
      }

      setPredictedAction(definition, nowMs, 0);
      return {
        accepted: true,
        skillId: definition.skillId ?? definition.id,
        slot
      };
    },
    requestBlockStart: (nowMs, serverState) => {
      if (isCombatStunned(nowMs, serverState) || !!predictedAction || isServerActionLocked(serverState)) {
        return false;
      }

      predictedBlockActive = nowMs < serverState.stunUntil ? false : true;
      return predictedBlockActive;
    },
    requestBlockEnd: () => {
      predictedBlockActive = false;
    },
    step: (nowMs, serverState) => {
      const comboResetMs = resolveComboResetMs(serverState, config.comboResetMs);
      if (comboChainIndex > 0 && nowMs - lastAttackAtMs > comboResetMs) {
        comboChainIndex = 0;
      }

      if (isCombatStunned(nowMs, serverState)) {
        predictedAction = null;
        queuedAttackRequested = false;
        predictedBlockActive = false;
      }

      advancePredictedAction(nowMs, serverState.heroId);
      return buildSnapshot(serverState, predictedAction, comboChainIndex, predictedBlockActive);
    },
    getSnapshot: (nowMs, serverState) => {
      const comboResetMs = resolveComboResetMs(serverState, config.comboResetMs);
      if (comboChainIndex > 0 && nowMs - lastAttackAtMs > comboResetMs) {
        comboChainIndex = 0;
      }

      return buildSnapshot(serverState, predictedAction, comboChainIndex, predictedBlockActive);
    }
  };
}
