// Responsável por orquestrar combo, skills, dano, morte e replicação de estados de combate de forma autoritativa.
import {
  resolveBasicAttackDefinition,
  resolveCombatKitDefinition,
  resolveSkillDefinition,
  type CombatActionDefinition,
  type CombatAttackPhase
} from "./combat-definition.js";
import type {
  CombatBlockEventPayload,
  CombatGuardBreakEventPayload,
  CombatHitEventPayload,
  CombatKillEventPayload,
  CombatPlayerDiedEventPayload,
  CombatRagdollEventPayload,
  CombatStateEventPayload,
  CombatUltimateEventPayload,
  MatchAttackStartedEventPayload,
  MatchBlockEndedEventPayload,
  MatchBlockStartedEventPayload,
  MatchPlayerState,
  MatchSkillCastFinishedEventPayload,
  MatchSkillCastStartedEventPayload
} from "../models/match-player.model.js";
import { setHealth } from "../services/health.service.js";
import {
  applyBlockedHitToGuard,
  BLOCK_GUARD_CONFIG,
  canBlockIncomingHit,
  canUseCombatActions,
  endBlock,
  startBlock,
  tickGuardState
} from "../services/block-guard.service.js";
import { applyLightKnockback } from "../services/melee-hit.service.js";
import { consumeUltimate, syncUltimateReady } from "../services/ultimate.service.js";
import {
  snapshotCombatState,
  didCombatStateChange,
  type PlayerCombatSnapshot
} from "../models/match-player.utils.js";

type ActiveActionRuntime = {
  definition: CombatActionDefinition;
  phase: CombatAttackPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  startedAt: number;
  comboIndex: 0 | 1 | 2 | 3;
  hitTargets: Set<string>;
  processedBurstOffsets: Set<number>;
};

type PlayerCombatRuntime = {
  activeAction: ActiveActionRuntime | null;
  queuedSkillSlot: 1 | 2 | 3 | 4 | 5 | null;
  ragdollEmittedAt: number;
};

export type CombatControllerResult = {
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

export type CombatController = {
  queueAttackStart: (sessionId: string) => void;
  queueSkillCast: (sessionId: string, slot: 1 | 2 | 3 | 4 | 5) => void;
  queueBlockStart: (sessionId: string) => void;
  queueBlockEnd: (sessionId: string) => void;
  clearPlayer: (sessionId: string) => void;
  update: (deltaSeconds: number, now: number) => CombatControllerResult;
};


function clampSkillSlot(slot: number): 1 | 2 | 3 | 4 | 5 | null {
  if (!Number.isFinite(slot)) {
    return null;
  }

  const normalized = Math.floor(slot);
  if (normalized < 1 || normalized > 5) {
    return null;
  }

  return normalized as 1 | 2 | 3 | 4 | 5;
}

function normalize2D(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  if (length <= 0.000001) {
    return { x: 0, z: 0 };
  }

  return {
    x: x / length,
    z: z / length
  };
}

function resolveForwardVector(rotationY: number): { x: number; z: number } {
  return {
    x: Math.sin(rotationY),
    z: Math.cos(rotationY)
  };
}

function isTargetInsideCone(
  attacker: MatchPlayerState,
  target: MatchPlayerState,
  angleDegrees: number
): boolean {
  if (angleDegrees >= 359) {
    return true;
  }

  const toTarget = normalize2D(target.x - attacker.x, target.z - attacker.z);
  if (toTarget.x === 0 && toTarget.z === 0) {
    return true;
  }

  const forward = normalize2D(resolveForwardVector(attacker.rotationY).x, resolveForwardVector(attacker.rotationY).z);
  const dot = forward.x * toTarget.x + forward.z * toTarget.z;
  const minDot = Math.cos((angleDegrees * Math.PI) / 360);
  return dot >= minDot;
}

function isTargetInsideRange(
  attacker: MatchPlayerState,
  target: MatchPlayerState,
  definition: CombatActionDefinition
): boolean {
  const deltaX = target.x - attacker.x;
  const deltaY = target.y - attacker.y;
  const deltaZ = target.z - attacker.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);
  const verticalDistance = Math.abs(deltaY);

  return horizontalDistance <= definition.range && verticalDistance <= Math.max(2.8, definition.radius);
}

function collectTargets(
  attacker: MatchPlayerState,
  players: Record<string, MatchPlayerState>,
  definition: CombatActionDefinition
): MatchPlayerState[] {
  const candidates = Object.values(players).filter((candidate) => {
    if (candidate.sessionId === attacker.sessionId || !candidate.isAlive) {
      return false;
    }

    if (!isTargetInsideRange(attacker, candidate, definition)) {
      return false;
    }

    switch (definition.targetingShape) {
      case "self_aoe":
        return true;
      case "projectile_line":
      case "melee_cone":
      default:
        return isTargetInsideCone(attacker, candidate, definition.angleDegrees);
    }
  });

  if (definition.targetingShape === "projectile_line") {
    const nearest = candidates.sort((left, right) => {
      const leftDistance = Math.hypot(left.x - attacker.x, left.z - attacker.z);
      const rightDistance = Math.hypot(right.x - attacker.x, right.z - attacker.z);
      return leftDistance - rightDistance;
    })[0];

    return nearest ? [nearest] : [];
  }

  return candidates;
}

function setIdleState(player: MatchPlayerState, now: number): void {
  player.isAttacking = false;
  player.combatState = player.isBlocking ? "Block" : player.isAlive ? "CombatIdle" : "Dead";
  player.combatStateStartedAt = now;
  player.combatStateEndsAt = 0;
  player.attackPhase = "None";
  player.activeActionId = "";
  player.activeSkillId = "";
  player.queuedAttack = false;
  player.isUsingUltimate = false;
  player.ultimateStartedAt = 0;
  player.ultimateEndsAt = 0;
}

function setDeadState(player: MatchPlayerState, now: number): void {
  const kit = resolveCombatKitDefinition(player.heroId);
  player.isAttacking = false;
  player.isBlocking = false;
  player.blockStartedAt = 0;
  player.combatState = "Dead";
  player.combatStateStartedAt = now;
  player.combatStateEndsAt = 0;
  player.attackPhase = "None";
  player.activeActionId = "";
  player.activeSkillId = "";
  player.queuedAttack = false;
  player.isUsingUltimate = false;
  player.ultimateStartedAt = 0;
  player.ultimateEndsAt = 0;
  player.deadAt = now;
  player.respawnAvailableAt = now + kit.respawnDelayMs;
}

function setHitReactState(player: MatchPlayerState, now: number, hitstunMs: number): void {
  player.combatState = "HitReact";
  player.combatStateStartedAt = now;
  player.combatStateEndsAt = now + hitstunMs;
  player.attackPhase = "None";
  player.activeActionId = "";
  player.activeSkillId = "";
  player.isAttacking = false;
  player.queuedAttack = false;
}

function applyActionPhaseState(player: MatchPlayerState, runtime: ActiveActionRuntime): void {
  player.attackPhase = runtime.phase;
  player.activeActionId = runtime.definition.id;
  player.activeSkillId = runtime.definition.skillId ?? "";
  player.combatStateStartedAt = runtime.phaseStartedAt;
  player.combatStateEndsAt = runtime.phaseEndsAt;
  player.isAttacking = runtime.definition.kind === "basicAttack";

  if (runtime.definition.kind === "skill") {
    player.combatState = "SkillCast";
    return;
  }

  switch (runtime.phase) {
    case "Windup":
      player.combatState = "AttackWindup";
      return;
    case "Active":
      player.combatState = "AttackActive";
      return;
    case "Recovery":
      player.combatState = "AttackRecovery";
      return;
    case "None":
    default:
      player.combatState = "CombatIdle";
  }
}

function canQueueNextAttack(runtime: ActiveActionRuntime | null, now: number): boolean {
  if (!runtime || runtime.definition.kind !== "basicAttack" || !runtime.definition.canQueueNextAttack) {
    return false;
  }

  const queueOpensAt = runtime.phaseEndsAt - runtime.definition.comboQueueWindowMs;
  return now >= queueOpensAt;
}

function buildCombatStatePayload(player: MatchPlayerState): CombatStateEventPayload {
  return {
    sessionId: player.sessionId,
    combatState: player.combatState,
    combatStateStartedAt: player.combatStateStartedAt,
    combatStateEndsAt: player.combatStateEndsAt,
    attackPhase: player.attackPhase,
    activeActionId: player.activeActionId,
    activeSkillId: player.activeSkillId,
    isAttacking: player.isAttacking,
    attackComboIndex: player.attackComboIndex,
    lastAttackAt: player.lastAttackAt,
    queuedAttack: player.queuedAttack,
    currentHealth: player.currentHealth,
    maxHealth: player.maxHealth,
    isAlive: player.isAlive,
    lastDamagedAt: player.lastDamagedAt,
    deadAt: player.deadAt,
    respawnAvailableAt: player.respawnAvailableAt,
    skillCooldowns: { ...player.skillCooldowns },
    isBlocking: player.isBlocking,
    blockStartedAt: player.blockStartedAt,
    maxGuard: player.maxGuard,
    currentGuard: player.currentGuard,
    isGuardBroken: player.isGuardBroken,
    stunUntil: player.stunUntil,
    lastGuardDamagedAt: player.lastGuardDamagedAt,
    x: player.x,
    y: player.y,
    z: player.z
  };
}

export function createCombatController(options: {
  players: () => Record<string, MatchPlayerState>;
}): CombatController {
  const queuedAttackStart = new Set<string>();
  const queuedBlockStart = new Set<string>();
  const queuedBlockEnd = new Set<string>();
  const queuedSkillCastBySessionId = new Map<string, 1 | 2 | 3 | 4 | 5>();
  const runtimeBySessionId = new Map<string, PlayerCombatRuntime>();

  const ensureRuntime = (sessionId: string): PlayerCombatRuntime => {
    const existing = runtimeBySessionId.get(sessionId);
    if (existing) {
      return existing;
    }

    const next: PlayerCombatRuntime = {
      activeAction: null,
      queuedSkillSlot: null,
      ragdollEmittedAt: 0
    };
    runtimeBySessionId.set(sessionId, next);
    return next;
  };

  const clearRuntime = (sessionId: string): void => {
    queuedAttackStart.delete(sessionId);
    queuedBlockStart.delete(sessionId);
    queuedBlockEnd.delete(sessionId);
    queuedSkillCastBySessionId.delete(sessionId);
    runtimeBySessionId.delete(sessionId);
  };

  const interruptPlayerAction = (player: MatchPlayerState, runtime: PlayerCombatRuntime, now: number): void => {
    runtime.activeAction = null;
    setIdleState(player, now);
  };

  const startBasicAttack = (
    player: MatchPlayerState,
    runtime: PlayerCombatRuntime,
    now: number
  ): MatchAttackStartedEventPayload | null => {
    if (!canUseCombatActions(player, now) || !player.isAlive) {
      return null;
    }

    if (runtime.activeAction) {
      if (!canQueueNextAttack(runtime.activeAction, now) || player.attackComboIndex >= 3) {
        return null;
      }

      player.queuedAttack = true;
      return null;
    }

    endBlock(player);
    const shouldResetCombo =
      player.attackComboIndex <= 0 ||
      now - player.lastAttackAt > resolveCombatKitDefinition(player.heroId).comboResetTimeMs;
    const comboIndex = shouldResetCombo
      ? 1
      : (Math.max(1, Math.min(3, player.attackComboIndex + 1)) as 1 | 2 | 3);
    const definition = resolveBasicAttackDefinition(player.heroId, comboIndex);
    const actionRuntime: ActiveActionRuntime = {
      definition,
      phase: "Windup",
      phaseStartedAt: now,
      phaseEndsAt: now + definition.windupMs,
      startedAt: now,
      comboIndex,
      hitTargets: new Set<string>(),
      processedBurstOffsets: new Set<number>()
    };

    runtime.activeAction = actionRuntime;
    player.attackComboIndex = comboIndex;
    player.lastAttackAt = now;
    player.queuedAttack = false;
    applyActionPhaseState(player, actionRuntime);

    return {
      sessionId: player.sessionId,
      attackId: definition.id,
      attackComboIndex: comboIndex,
      startedAt: now
    };
  };

  const startSkillCast = (
    player: MatchPlayerState,
    runtime: PlayerCombatRuntime,
    slot: 1 | 2 | 3 | 4 | 5,
    now: number
  ): { started: MatchSkillCastStartedEventPayload | null; ultimate: CombatUltimateEventPayload | null } => {
    if (!canUseCombatActions(player, now) || !player.isAlive) {
      return { started: null, ultimate: null };
    }

    if (runtime.activeAction) {
      return { started: null, ultimate: null };
    }

    const definition = resolveSkillDefinition(player.heroId, slot);
    const cooldownEndsAt = player.skillCooldowns[definition.skillId ?? definition.id] ?? 0;
    if (cooldownEndsAt > now) {
      return { started: null, ultimate: null };
    }

    syncUltimateReady(player);
    if (definition.ultimateChargeCost && (!player.isUltimateReady || player.ultimateCharge < player.ultimateMax)) {
      return { started: null, ultimate: null };
    }

    if (definition.ultimateChargeCost && !consumeUltimate(player)) {
      return { started: null, ultimate: null };
    }

    endBlock(player);
    const totalDurationMs = definition.windupMs + definition.activeMs + definition.recoveryMs;
    const actionRuntime: ActiveActionRuntime = {
      definition,
      phase: "Windup",
      phaseStartedAt: now,
      phaseEndsAt: now + definition.windupMs,
      startedAt: now,
      comboIndex: 0,
      hitTargets: new Set<string>(),
      processedBurstOffsets: new Set<number>()
    };

    runtime.activeAction = actionRuntime;
    runtime.queuedSkillSlot = null;
    player.queuedAttack = false;
    player.attackComboIndex = 0;
    player.activeSkillId = definition.skillId ?? "";
    player.skillCooldowns[definition.skillId ?? definition.id] = now + definition.cooldownMs;
    player.isUsingUltimate = definition.sourceType === "ultimate";
    player.ultimateStartedAt = player.isUsingUltimate ? now : 0;
    player.ultimateEndsAt = player.isUsingUltimate ? now + totalDurationMs : 0;
    applyActionPhaseState(player, actionRuntime);

    return {
      started: {
        sessionId: player.sessionId,
        skillId: definition.skillId ?? definition.id,
        skillSlot: slot,
        startedAt: now,
        endsAt: now + totalDurationMs,
        cooldownEndsAt: now + definition.cooldownMs,
        isUltimate: definition.sourceType === "ultimate"
      },
      ultimate:
        definition.sourceType === "ultimate"
          ? {
              sessionId: player.sessionId,
              characterId: player.heroId,
              skillId: definition.skillId ?? definition.id,
              durationMs: totalDurationMs,
              startedAt: now,
              endsAt: now + totalDurationMs
            }
          : null
    };
  };

  const applyActionBurst = (
    attacker: MatchPlayerState,
    runtime: ActiveActionRuntime,
    players: Record<string, MatchPlayerState>,
    now: number,
    result: CombatControllerResult,
    markPlayerChanged: (player: MatchPlayerState) => void
  ): void => {
    const targets = collectTargets(attacker, players, runtime.definition);
    targets.forEach((target) => {
      if (runtime.hitTargets.has(target.sessionId)) {
        return;
      }

      runtime.hitTargets.add(target.sessionId);
      const wasBlocking = runtime.definition.isBlockable && canBlockIncomingHit(target, attacker, now);
      if (wasBlocking) {
        const guardResult = applyBlockedHitToGuard(target, attacker.attackComboIndex || 1, now);
        result.hitEvents.push({
          attackerSessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          sourceType: runtime.definition.sourceType,
          sourceId: runtime.definition.id,
          damage: 0,
          comboHitIndex: attacker.attackComboIndex,
          wasBlocked: true,
          didGuardBreak: guardResult.didGuardBreak,
          knockback: 0,
          hitstunMs: guardResult.didGuardBreak ? BLOCK_GUARD_CONFIG.guardBreakStunMs : 0,
          targetHealth: target.currentHealth
        });
        result.blockEvents.push({
          attackerSessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          comboHitIndex: attacker.attackComboIndex || 1,
          guardDamage: guardResult.guardDamageApplied,
          currentGuard: target.currentGuard,
          maxGuard: target.maxGuard,
          didGuardBreak: guardResult.didGuardBreak
        });
        if (guardResult.didGuardBreak) {
          result.guardBreakEvents.push({
            attackerSessionId: attacker.sessionId,
            targetSessionId: target.sessionId,
            guardBreakDurationMs: BLOCK_GUARD_CONFIG.guardBreakStunMs
          });
        }
        markPlayerChanged(target);
        return;
      }

      const targetWasAlive = target.isAlive;
      const nextHealth = target.currentHealth - runtime.definition.damage;
      setHealth(target, nextHealth);
      target.lastDamagedAt = now;
      target.isBlocking = false;
      target.blockStartedAt = 0;
      target.stunUntil = Math.max(target.stunUntil, now + runtime.definition.hitstunMs);
      applyLightKnockback(attacker, target, runtime.definition.knockback);

      const targetRuntime = ensureRuntime(target.sessionId);
      interruptPlayerAction(target, targetRuntime, now);

      result.hitEvents.push({
        attackerSessionId: attacker.sessionId,
        targetSessionId: target.sessionId,
        sourceType: runtime.definition.sourceType,
        sourceId: runtime.definition.id,
        damage: runtime.definition.damage,
        comboHitIndex: attacker.attackComboIndex,
        wasBlocked: false,
        didGuardBreak: false,
        knockback: runtime.definition.knockback,
        hitstunMs: runtime.definition.hitstunMs,
        targetHealth: target.currentHealth
      });

      if (target.isAlive) {
        setHitReactState(target, now, runtime.definition.hitstunMs);
      } else if (targetWasAlive) {
        setDeadState(target, now);
        result.deathEvents.push({
          sessionId: target.sessionId,
          killerSessionId: attacker.sessionId,
          deadAt: now,
          respawnAvailableAt: target.respawnAvailableAt
        });
        attacker.kills += 1;
        target.deaths += 1;
        result.killEvents.push({
          killerSessionId: attacker.sessionId,
          victimSessionId: target.sessionId,
          killerName: attacker.nickname,
          victimName: target.nickname,
          killerKills: attacker.kills,
          victimDeaths: target.deaths,
          timestamp: now
        });
      }

      markPlayerChanged(target);
    });
  };

  const advanceActionPhase = (
    player: MatchPlayerState,
    runtime: PlayerCombatRuntime,
    players: Record<string, MatchPlayerState>,
    now: number,
    result: CombatControllerResult,
    markPlayerChanged: (player: MatchPlayerState) => void
  ): void => {
    const activeAction = runtime.activeAction;
    if (!activeAction) {
      return;
    }

    const hitBursts = activeAction.definition.hitBursts ?? [{ offsetMs: 0 }];
    if (activeAction.phase === "Active") {
      hitBursts.forEach((burst) => {
        if (activeAction.processedBurstOffsets.has(burst.offsetMs)) {
          return;
        }

        if (now < activeAction.phaseStartedAt + burst.offsetMs) {
          return;
        }

        activeAction.processedBurstOffsets.add(burst.offsetMs);
        applyActionBurst(player, activeAction, players, now, result, markPlayerChanged);
        markPlayerChanged(player);
      });
    }

    if (now < activeAction.phaseEndsAt) {
      return;
    }

    if (activeAction.phase === "Windup") {
      activeAction.phase = "Active";
      activeAction.phaseStartedAt = now;
      activeAction.phaseEndsAt = now + activeAction.definition.activeMs;
      applyActionPhaseState(player, activeAction);
      markPlayerChanged(player);
      return;
    }

    if (activeAction.phase === "Active") {
      activeAction.phase = "Recovery";
      activeAction.phaseStartedAt = now;
      activeAction.phaseEndsAt = now + activeAction.definition.recoveryMs;
      applyActionPhaseState(player, activeAction);
      markPlayerChanged(player);
      return;
    }

    const finishedSkillId = activeAction.definition.skillId ?? "";
    const queuedAttack = player.queuedAttack;
    runtime.activeAction = null;
    player.isAttacking = false;
    player.activeActionId = "";
    player.activeSkillId = "";
    player.attackPhase = "None";
    player.queuedAttack = false;
    if (activeAction.definition.kind === "skill" && finishedSkillId) {
      result.skillCastFinishedEvents.push({
        sessionId: player.sessionId,
        skillId: finishedSkillId,
        finishedAt: now
      });
    }

    if (queuedAttack && player.isAlive) {
      const attackEvent = startBasicAttack(player, runtime, now);
      if (attackEvent) {
        result.attackStartedEvents.push(attackEvent);
      }
      markPlayerChanged(player);
      return;
    }

    setIdleState(player, now);
    markPlayerChanged(player);
  };

  return {
    queueAttackStart: (sessionId) => {
      queuedAttackStart.add(sessionId);
    },
    queueSkillCast: (sessionId, slot) => {
      queuedSkillCastBySessionId.set(sessionId, slot);
    },
    queueBlockStart: (sessionId) => {
      queuedBlockStart.add(sessionId);
    },
    queueBlockEnd: (sessionId) => {
      queuedBlockEnd.add(sessionId);
    },
    clearPlayer: clearRuntime,
    update: (deltaSeconds, now) => {
      const players = options.players();
      const combatSnapshots = new Map<string, PlayerCombatSnapshot>();
      Object.values(players).forEach((player) => {
        combatSnapshots.set(player.sessionId, snapshotCombatState(player));
      });

      const changedPlayers = new Map<string, MatchPlayerState>();
      const result: CombatControllerResult = {
        didChangeState: false,
        combatStateChangedPlayers: [],
        attackStartedEvents: [],
        blockStartedEvents: [],
        blockEndedEvents: [],
        hitEvents: [],
        blockEvents: [],
        guardBreakEvents: [],
        killEvents: [],
        skillCastStartedEvents: [],
        skillCastFinishedEvents: [],
        deathEvents: [],
        ragdollEvents: [],
        ultimateEvents: []
      };
      const markPlayerChanged = (player: MatchPlayerState): void => {
        changedPlayers.set(player.sessionId, player);
        result.didChangeState = true;
      };

      Array.from(queuedBlockEnd.values()).forEach((sessionId) => {
        const player = players[sessionId];
        if (!player) {
          return;
        }

        if (!endBlock(player)) {
          return;
        }

        markPlayerChanged(player);
        result.blockEndedEvents.push({
          sessionId: player.sessionId,
          blockEndedAt: now
        });
      });
      queuedBlockEnd.clear();

      Array.from(queuedBlockStart.values()).forEach((sessionId) => {
        const player = players[sessionId];
        const runtime = player ? ensureRuntime(sessionId) : null;
        if (!player || !runtime || runtime.activeAction) {
          return;
        }

        if (!startBlock(player, now)) {
          return;
        }

        player.combatState = "Block";
        player.combatStateStartedAt = now;
        player.combatStateEndsAt = 0;
        markPlayerChanged(player);
        result.blockStartedEvents.push({
          sessionId: player.sessionId,
          blockStartedAt: player.blockStartedAt
        });
      });
      queuedBlockStart.clear();

      queuedSkillCastBySessionId.forEach((slot, sessionId) => {
        const player = players[sessionId];
        const runtime = player ? ensureRuntime(sessionId) : null;
        if (!player || !runtime) {
          return;
        }

        const started = startSkillCast(player, runtime, slot, now);
        if (!started.started) {
          return;
        }

        result.skillCastStartedEvents.push(started.started);
        if (started.ultimate) {
          result.ultimateEvents.push(started.ultimate);
        }
        markPlayerChanged(player);
      });
      queuedSkillCastBySessionId.clear();

      Array.from(queuedAttackStart.values()).forEach((sessionId) => {
        const player = players[sessionId];
        const runtime = player ? ensureRuntime(sessionId) : null;
        if (!player || !runtime) {
          return;
        }

        const attackEvent = startBasicAttack(player, runtime, now);
        if (!attackEvent) {
          return;
        }

        result.attackStartedEvents.push(attackEvent);
        markPlayerChanged(player);
      });
      queuedAttackStart.clear();

      Object.values(players).forEach((player) => {
        const runtime = ensureRuntime(player.sessionId);
        syncUltimateReady(player);

        if (!player.isAlive) {
          if (runtime.activeAction) {
            runtime.activeAction = null;
          }

          const ragdollAt = player.deadAt + resolveCombatKitDefinition(player.heroId).ragdollDelayMs;
          if (player.deadAt > 0 && runtime.ragdollEmittedAt === 0 && now >= ragdollAt) {
            runtime.ragdollEmittedAt = now;
            result.ragdollEvents.push({
              sessionId: player.sessionId,
              enabledAt: now
            });
            markPlayerChanged(player);
          }
        } else {
          runtime.ragdollEmittedAt = 0;
        }

        advanceActionPhase(player, runtime, players, now, result, markPlayerChanged);

        if (!player.isAlive) {
          setDeadState(player, player.deadAt || now);
        } else if (!runtime.activeAction && player.combatState === "HitReact" && now >= player.combatStateEndsAt) {
          setIdleState(player, now);
        }

        if (tickGuardState(player, deltaSeconds, now)) {
          if (player.isBlocking && !runtime.activeAction) {
            player.combatState = "Block";
            player.combatStateStartedAt = player.blockStartedAt;
          } else if (!player.isBlocking && !runtime.activeAction && player.isAlive && player.combatState === "Block") {
            setIdleState(player, now);
          }
          markPlayerChanged(player);
        }
      });

      Object.values(players).forEach((player) => {
        const previous = combatSnapshots.get(player.sessionId);
        if (!previous) {
          return;
        }

        if (!didCombatStateChange(previous, player)) {
          return;
        }

        changedPlayers.set(player.sessionId, player);
        result.didChangeState = true;
      });

      result.combatStateChangedPlayers = Array.from(changedPlayers.values());
      return result;
    }
  };
}

export function buildCombatStatePayloadForPlayer(player: MatchPlayerState): CombatStateEventPayload {
  return buildCombatStatePayload(player);
}
