// Responsável por formalizar o estado de combate local previsto (ataque, cooldown, block e stun) sem booleans soltas na cena.
export const COMBAT_RUNTIME_STATES = [
  "Idle",
  "Active",
  "Cooldown",
  "Block",
  "Stunned"
] as const;

export type CombatRuntimeState = (typeof COMBAT_RUNTIME_STATES)[number];

export type CombatStateMachineConfig = {
  attackIntervalMs: number;
  comboResetMs: number;
  attackAnimationWindowMs: number;
  attackInputBufferMs: number;
  blockMaxHoldMs: number;
};

export type CombatStateMachineServerState = {
  isAlive: boolean;
  isAttacking: boolean;
  attackComboIndex: number;
  isBlocking: boolean;
  isGuardBroken: boolean;
  stunUntil: number;
};

export type CombatStateSnapshot = {
  state: CombatRuntimeState;
  comboChainIndex: 0 | 1 | 2 | 3;
  activeAttackComboIndex: 0 | 1 | 2 | 3;
  bufferedAttackUntilMs: number;
  lastAttackAtMs: number;
  isBlocking: boolean;
  blockStartedAtMs: number;
};

export type AttackRequestResult = {
  accepted: boolean;
  buffered: boolean;
  comboIndex: 0 | 1 | 2 | 3;
};

export type CombatStateMachine = {
  reset: () => void;
  requestAttack: (nowMs: number, serverState: CombatStateMachineServerState) => AttackRequestResult;
  requestBlockStart: (nowMs: number, serverState: CombatStateMachineServerState) => boolean;
  requestBlockEnd: () => void;
  step: (nowMs: number, serverState: CombatStateMachineServerState) => CombatStateSnapshot;
  getSnapshot: (nowMs: number, serverState: CombatStateMachineServerState) => CombatStateSnapshot;
};

function resolveSafeAttackComboIndex(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const clamped = Math.max(1, Math.min(3, Math.floor(value)));
  return clamped as 1 | 2 | 3;
}

function isCombatStunned(nowMs: number, serverState: CombatStateMachineServerState): boolean {
  if (!serverState.isAlive) {
    return true;
  }

  if (serverState.isGuardBroken) {
    return true;
  }

  return nowMs < serverState.stunUntil;
}

export function createCombatStateMachine(config: CombatStateMachineConfig): CombatStateMachine {
  let comboChainIndex: 0 | 1 | 2 | 3 = 0;
  let activeAttackComboIndex: 0 | 1 | 2 | 3 = 0;
  let lastAttackAtMs = 0;
  let attackUntilMs = 0;
  let bufferedAttackUntilMs = 0;
  let predictedBlockActive = false;
  let blockStartedAtMs = 0;

  const reset = (): void => {
    comboChainIndex = 0;
    activeAttackComboIndex = 0;
    lastAttackAtMs = 0;
    attackUntilMs = 0;
    bufferedAttackUntilMs = 0;
    predictedBlockActive = false;
    blockStartedAtMs = 0;
  };

  const commitAttack = (nowMs: number): AttackRequestResult => {
    const shouldResetCombo =
      comboChainIndex <= 0 ||
      nowMs - lastAttackAtMs > config.comboResetMs;

    comboChainIndex = shouldResetCombo
      ? 1
      : (((comboChainIndex % 3) + 1) as 1 | 2 | 3);
    activeAttackComboIndex = comboChainIndex;
    lastAttackAtMs = nowMs;
    attackUntilMs = nowMs + config.attackAnimationWindowMs;
    bufferedAttackUntilMs = 0;
    predictedBlockActive = false;
    blockStartedAtMs = 0;

    return {
      accepted: true,
      buffered: false,
      comboIndex: activeAttackComboIndex
    };
  };

  const syncInternalState = (
    nowMs: number,
    serverState: CombatStateMachineServerState
  ): CombatStateSnapshot => {
    if (activeAttackComboIndex > 0 && nowMs >= attackUntilMs) {
      activeAttackComboIndex = 0;
      attackUntilMs = 0;
    }

    if (comboChainIndex > 0 && nowMs - lastAttackAtMs > config.comboResetMs) {
      comboChainIndex = 0;
    }

    const stunned = isCombatStunned(nowMs, serverState);
    if (stunned) {
      predictedBlockActive = false;
      blockStartedAtMs = 0;
      bufferedAttackUntilMs = 0;
    }

    const canCommitBufferedAttack =
      bufferedAttackUntilMs > 0 &&
      nowMs <= bufferedAttackUntilMs &&
      !stunned &&
      nowMs - lastAttackAtMs >= config.attackIntervalMs;
    if (canCommitBufferedAttack) {
      commitAttack(nowMs);
    } else if (bufferedAttackUntilMs > 0 && nowMs > bufferedAttackUntilMs) {
      bufferedAttackUntilMs = 0;
    }

    if (
      predictedBlockActive &&
      blockStartedAtMs > 0 &&
      nowMs - blockStartedAtMs >= config.blockMaxHoldMs
    ) {
      predictedBlockActive = false;
      blockStartedAtMs = 0;
    }

    const serverAttackComboIndex = serverState.isAttacking
      ? resolveSafeAttackComboIndex(serverState.attackComboIndex)
      : 0;
    const resolvedActiveAttackComboIndex = activeAttackComboIndex > 0
      ? activeAttackComboIndex
      : serverAttackComboIndex;
    const resolvedBlocking =
      !stunned &&
      (predictedBlockActive || serverState.isBlocking) &&
      resolvedActiveAttackComboIndex === 0;

    let state: CombatRuntimeState = "Idle";
    if (stunned) {
      state = "Stunned";
    } else if (resolvedActiveAttackComboIndex > 0) {
      state = "Active";
    } else if (resolvedBlocking) {
      state = "Block";
    } else if (comboChainIndex > 0 && nowMs - lastAttackAtMs < config.attackIntervalMs) {
      state = "Cooldown";
    }

    return {
      state,
      comboChainIndex,
      activeAttackComboIndex: resolvedActiveAttackComboIndex,
      bufferedAttackUntilMs,
      lastAttackAtMs,
      isBlocking: resolvedBlocking,
      blockStartedAtMs
    };
  };

  return {
    reset,
    requestAttack: (nowMs, serverState) => {
      const snapshot = syncInternalState(nowMs, serverState);
      if (snapshot.state === "Stunned") {
        return {
          accepted: false,
          buffered: false,
          comboIndex: 0
        };
      }

      const elapsedSinceLastAttack = nowMs - lastAttackAtMs;
      if (elapsedSinceLastAttack < config.attackIntervalMs) {
        const remainingCooldown = config.attackIntervalMs - elapsedSinceLastAttack;
        if (remainingCooldown <= config.attackInputBufferMs) {
          bufferedAttackUntilMs = nowMs + config.attackInputBufferMs;
          return {
            accepted: false,
            buffered: true,
            comboIndex: 0
          };
        }

        return {
          accepted: false,
          buffered: false,
          comboIndex: 0
        };
      }

      return commitAttack(nowMs);
    },
    requestBlockStart: (nowMs, serverState) => {
      const snapshot = syncInternalState(nowMs, serverState);
      if (snapshot.state === "Stunned" || snapshot.activeAttackComboIndex > 0 || snapshot.isBlocking) {
        return false;
      }

      predictedBlockActive = true;
      blockStartedAtMs = nowMs;
      return true;
    },
    requestBlockEnd: () => {
      predictedBlockActive = false;
      blockStartedAtMs = 0;
    },
    step: (nowMs, serverState) => {
      return syncInternalState(nowMs, serverState);
    },
    getSnapshot: (nowMs, serverState) => {
      return syncInternalState(nowMs, serverState);
    }
  };
}
