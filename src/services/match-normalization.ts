// Responsavel por normalizar e validar payloads recebidos do servidor da partida antes de consumir no cliente.
import {
  isCharacterLocomotionState,
  isWallRunSide
} from "@/shared/character-state";
import { clamp } from "@/utils/math";
import type {
  MatchAttackStartedEventPayload,
  MatchBlockEndedEventPayload,
  MatchBlockStartedEventPayload,
  MatchCombatBlockPayload,
  MatchCombatPlayerDiedPayload,
  MatchCombatRagdollPayload,
  MatchCombatGuardBreakPayload,
  MatchCombatHitPayload,
  MatchCombatKillPayload,
  MatchCombatStatePayload,
  MatchCombatUltimatePayload,
  MatchPlayerMovedPayload,
  MatchPlayerRespawnedEventPayload,
  MatchPlayerJoinedPayload,
  MatchPlayerLeftPayload,
  MatchPlayerLocomotionState,
  MatchPlayerState,
  MatchPlayerWallRunSide,
  MatchSkillCastFinishedEventPayload,
  MatchSkillCastStartedEventPayload,
  MatchSnapshotPayload
} from "@/shared/match/match-player.model";
import type { MatchIdentity } from "./match.service";

export const DEFAULT_MAX_HEALTH = 1000;
export const DEFAULT_ULTIMATE_MAX = 100;
export const DEFAULT_MAX_STAMINA = 100;
export const DEFAULT_MAX_GUARD = 100;
export const DEFAULT_SCORE_VALUE = 0;

export function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

export function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

export function normalizeRecordOfNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, entry]) => {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      return acc;
    }

    acc[key] = entry;
    return acc;
  }, {});
}

export function normalizeLocomotionState(value: unknown): MatchPlayerLocomotionState {
  return isCharacterLocomotionState(value) ? value : "Idle";
}

export function normalizeWallRunSide(value: unknown): MatchPlayerWallRunSide {
  return isWallRunSide(value) ? value : "none";
}

export function normalizeIdentity(identity: MatchIdentity | null): MatchIdentity | null {
  if (!identity) {
    return null;
  }

  const userId = normalizeText(identity.userId);
  const nickname = normalizeText(identity.nickname);
  const heroId = normalizeText(identity.heroId);
  const heroLevel = Math.max(1, Math.floor(normalizeNumber(identity.heroLevel) ?? 1));

  if (!userId || !nickname || !heroId) {
    return null;
  }

  return {
    userId,
    nickname,
    heroId,
    heroLevel
  };
}

export function normalizePlayer(value: unknown): MatchPlayerState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MatchPlayerState>;
  const sessionId = normalizeText(candidate.sessionId);
  const userId = normalizeText(candidate.userId);
  const nickname = normalizeText(candidate.nickname);
  const heroId = normalizeText(candidate.heroId);
  const heroLevel = Math.max(1, Math.floor(normalizeNumber(candidate.heroLevel) ?? 1));
  const x = normalizeNumber(candidate.x);
  const y = normalizeNumber(candidate.y);
  const z = normalizeNumber(candidate.z);
  const rotationY = normalizeNumber(candidate.rotationY);
  const kills = normalizeNumber(candidate.kills) ?? DEFAULT_SCORE_VALUE;
  const deaths = normalizeNumber(candidate.deaths) ?? DEFAULT_SCORE_VALUE;
  const maxHealth = normalizeNumber(candidate.maxHealth) ?? DEFAULT_MAX_HEALTH;
  const currentHealth = normalizeNumber(candidate.currentHealth) ?? maxHealth;
  const isAlive = normalizeBoolean(candidate.isAlive) ?? currentHealth > 0;
  const ultimateMax = normalizeNumber(candidate.ultimateMax) ?? DEFAULT_ULTIMATE_MAX;
  const ultimateCharge = normalizeNumber(candidate.ultimateCharge) ?? 0;
  const isUltimateReady = normalizeBoolean(candidate.isUltimateReady) ?? ultimateCharge >= ultimateMax;
  const isUsingUltimate = normalizeBoolean(candidate.isUsingUltimate) ?? false;
  const ultimateStartedAt = normalizeNumber(candidate.ultimateStartedAt) ?? 0;
  const ultimateEndsAt = normalizeNumber(candidate.ultimateEndsAt) ?? 0;
  const maxStamina = normalizeNumber(candidate.maxStamina) ?? DEFAULT_MAX_STAMINA;
  const currentStamina = normalizeNumber(candidate.currentStamina) ?? maxStamina;
  const isSprinting = normalizeBoolean(candidate.isSprinting) ?? false;
  const locomotionState = normalizeLocomotionState(candidate.locomotionState);
  const isCrouching = normalizeBoolean(candidate.isCrouching) ?? false;
  const isRolling = normalizeBoolean(candidate.isRolling) ?? false;
  const isWallRunning = normalizeBoolean(candidate.isWallRunning) ?? false;
  const wallRunSide = normalizeWallRunSide(candidate.wallRunSide);
  const verticalVelocity = normalizeNumber(candidate.verticalVelocity) ?? 0;
  const sprintBlocked = normalizeBoolean(candidate.sprintBlocked) ?? currentStamina <= 0;
  const isAttacking = normalizeBoolean(candidate.isAttacking) ?? false;
  const attackComboIndex = normalizeNumber(candidate.attackComboIndex) ?? 0;
  const lastAttackAt = normalizeNumber(candidate.lastAttackAt) ?? 0;
  const combatState = typeof candidate.combatState === "string" ? candidate.combatState : "CombatIdle";
  const combatStateStartedAt = normalizeNumber(candidate.combatStateStartedAt) ?? 0;
  const combatStateEndsAt = normalizeNumber(candidate.combatStateEndsAt) ?? 0;
  const attackPhase = typeof candidate.attackPhase === "string" ? candidate.attackPhase : "None";
  const activeActionId = normalizeText(candidate.activeActionId) ?? "";
  const activeSkillId = normalizeText(candidate.activeSkillId) ?? "";
  const queuedAttack = normalizeBoolean(candidate.queuedAttack) ?? false;
  const lastDamagedAt = normalizeNumber(candidate.lastDamagedAt) ?? 0;
  const deadAt = normalizeNumber(candidate.deadAt) ?? 0;
  const respawnAvailableAt = normalizeNumber(candidate.respawnAvailableAt) ?? 0;
  const skillCooldowns = normalizeRecordOfNumbers(candidate.skillCooldowns);
  const isBlocking = normalizeBoolean(candidate.isBlocking) ?? false;
  const blockStartedAt = normalizeNumber(candidate.blockStartedAt) ?? 0;
  const maxGuard = normalizeNumber(candidate.maxGuard) ?? DEFAULT_MAX_GUARD;
  const currentGuard = normalizeNumber(candidate.currentGuard) ?? maxGuard;
  const isGuardBroken = normalizeBoolean(candidate.isGuardBroken) ?? false;
  const stunUntil = normalizeNumber(candidate.stunUntil) ?? 0;
  const lastGuardDamagedAt = normalizeNumber(candidate.lastGuardDamagedAt) ?? 0;
  const joinedAt = typeof candidate.joinedAt === "number" ? candidate.joinedAt : Date.now();
  const lastSprintEndedAt = normalizeNumber(candidate.lastSprintEndedAt) ?? joinedAt;

  if (!sessionId || !userId || !nickname || !heroId || x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  const safeCurrentHealth = Math.max(0, Math.min(Math.floor(currentHealth), safeMaxHealth));
  const safeUltimateMax = Math.max(1, Math.floor(ultimateMax));
  const safeUltimateCharge = Math.max(0, Math.min(Math.floor(ultimateCharge), safeUltimateMax));
  const safeKills = Math.max(0, Math.floor(kills));
  const safeDeaths = Math.max(0, Math.floor(deaths));
  const safeMaxStamina = Math.max(1, maxStamina);
  const safeCurrentStamina = clamp(currentStamina, 0, safeMaxStamina);
  const safeIsAlive = safeCurrentHealth > 0 ? isAlive : false;
  const safeSprintBlocked = sprintBlocked || safeCurrentStamina <= 0;
  const safeIsSprinting =
    safeIsAlive && !safeSprintBlocked && safeCurrentStamina > 0 ? isSprinting : false;
  const safeMaxGuard = Math.max(1, maxGuard);
  const safeCurrentGuard = clamp(currentGuard, 0, safeMaxGuard);
  const safeAttackComboIndex = Math.max(0, Math.min(3, Math.floor(attackComboIndex)));

  return {
    sessionId,
    userId,
    nickname,
    heroId,
    heroLevel,
    x,
    y,
    z,
    rotationY,
    kills: safeKills,
    deaths: safeDeaths,
    maxHealth: safeMaxHealth,
    currentHealth: safeCurrentHealth,
    isAlive: safeIsAlive,
    ultimateCharge: safeUltimateCharge,
    ultimateMax: safeUltimateMax,
    isUltimateReady: safeUltimateCharge >= safeUltimateMax ? true : isUltimateReady,
    isUsingUltimate,
    ultimateStartedAt,
    ultimateEndsAt,
    maxStamina: safeMaxStamina,
    currentStamina: safeCurrentStamina,
    isSprinting: safeIsSprinting,
    locomotionState,
    isCrouching: safeIsAlive ? isCrouching : false,
    isRolling: safeIsAlive ? isRolling : false,
    isWallRunning: safeIsAlive ? isWallRunning : false,
    wallRunSide: safeIsAlive ? wallRunSide : "none",
    verticalVelocity: safeIsAlive ? verticalVelocity : 0,
    sprintBlocked: safeSprintBlocked,
    lastSprintEndedAt,
    isAttacking: safeIsAlive ? isAttacking : false,
    attackComboIndex: safeAttackComboIndex,
    lastAttackAt,
    combatState: safeIsAlive ? (combatState as MatchPlayerState["combatState"]) : "Dead",
    combatStateStartedAt,
    combatStateEndsAt,
    attackPhase: attackPhase as MatchPlayerState["attackPhase"],
    activeActionId: safeIsAlive ? activeActionId : "",
    activeSkillId: safeIsAlive ? activeSkillId : "",
    queuedAttack: safeIsAlive ? queuedAttack : false,
    lastDamagedAt,
    deadAt,
    respawnAvailableAt,
    skillCooldowns,
    isBlocking: safeIsAlive ? isBlocking : false,
    blockStartedAt,
    maxGuard: safeMaxGuard,
    currentGuard: safeCurrentGuard,
    isGuardBroken,
    stunUntil,
    lastGuardDamagedAt,
    joinedAt
  };
}

export function normalizeSnapshot(payload: unknown): MatchPlayerState[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as Partial<MatchSnapshotPayload>;
  if (!candidate.players || typeof candidate.players !== "object") {
    return [];
  }

  return Object.values(candidate.players)
    .map((player) => normalizePlayer(player))
    .filter((player): player is MatchPlayerState => player !== null);
}

export function normalizeJoinedPayload(payload: unknown): MatchPlayerState | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerJoinedPayload>;
  return normalizePlayer(candidate.player);
}

export function normalizeLeftPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerLeftPayload>;
  return normalizeText(candidate.sessionId);
}

export function normalizeMovedPayload(payload: unknown): MatchPlayerMovedPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerMovedPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const x = normalizeNumber(candidate.x);
  const y = normalizeNumber(candidate.y);
  const z = normalizeNumber(candidate.z);
  const rotationY = normalizeNumber(candidate.rotationY);
  const locomotionState = normalizeLocomotionState(candidate.locomotionState);
  const isCrouching = normalizeBoolean(candidate.isCrouching) ?? false;
  const isRolling = normalizeBoolean(candidate.isRolling) ?? false;
  const isWallRunning = normalizeBoolean(candidate.isWallRunning) ?? false;
  const wallRunSide = normalizeWallRunSide(candidate.wallRunSide);
  const verticalVelocity = normalizeNumber(candidate.verticalVelocity) ?? 0;

  if (!sessionId || x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  return {
    sessionId,
    x,
    y,
    z,
    rotationY,
    locomotionState,
    isCrouching,
    isRolling,
    isWallRunning,
    wallRunSide,
    verticalVelocity
  };
}

export function normalizeAttackStartedPayload(payload: unknown): MatchAttackStartedEventPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchAttackStartedEventPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const attackComboIndex = normalizeNumber(candidate.attackComboIndex);
  const startedAt = normalizeNumber(candidate.startedAt);
  if (!sessionId || attackComboIndex === null || startedAt === null) {
    return null;
  }

  return {
    sessionId,
    attackId: normalizeText(candidate.attackId) ?? "",
    attackComboIndex: Math.max(1, Math.min(3, Math.floor(attackComboIndex))),
    startedAt
  };
}

export function normalizeBlockStartedPayload(payload: unknown): MatchBlockStartedEventPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchBlockStartedEventPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const blockStartedAt = normalizeNumber(candidate.blockStartedAt);
  if (!sessionId || blockStartedAt === null) {
    return null;
  }

  return {
    sessionId,
    blockStartedAt
  };
}

export function normalizeBlockEndedPayload(payload: unknown): MatchBlockEndedEventPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchBlockEndedEventPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const blockEndedAt = normalizeNumber(candidate.blockEndedAt);
  if (!sessionId || blockEndedAt === null) {
    return null;
  }

  return {
    sessionId,
    blockEndedAt
  };
}

export function normalizeRespawnedPayload(payload: unknown): MatchPlayerRespawnedEventPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerRespawnedEventPayload>;
  const player = normalizePlayer(candidate.player);
  const respawnedAt = normalizeNumber(candidate.respawnedAt);

  if (!player || respawnedAt === null) {
    return null;
  }

  return {
    player,
    respawnedAt
  };
}

export function normalizeCombatHitPayload(payload: unknown): MatchCombatHitPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatHitPayload>;
  const attackerSessionId = normalizeText(candidate.attackerSessionId);
  const targetSessionId = normalizeText(candidate.targetSessionId);
  const damage = normalizeNumber(candidate.damage);
  const comboHitIndex = normalizeNumber(candidate.comboHitIndex);
  const wasBlocked = normalizeBoolean(candidate.wasBlocked);
  const didGuardBreak = normalizeBoolean(candidate.didGuardBreak);

  if (
    !attackerSessionId ||
    !targetSessionId ||
    damage === null ||
    comboHitIndex === null ||
    wasBlocked === null ||
    didGuardBreak === null
  ) {
    return null;
  }

  return {
    attackerSessionId,
    targetSessionId,
    sourceType:
      candidate.sourceType === "basic_melee" ||
      candidate.sourceType === "skill" ||
      candidate.sourceType === "ultimate" ||
      candidate.sourceType === "environment"
        ? candidate.sourceType
        : "basic_melee",
    sourceId: normalizeText(candidate.sourceId) ?? "",
    damage: Math.max(0, Math.floor(damage)),
    comboHitIndex: Math.max(1, Math.min(3, Math.floor(comboHitIndex))),
    wasBlocked,
    didGuardBreak,
    knockback: Math.max(0, normalizeNumber(candidate.knockback) ?? 0),
    hitstunMs: Math.max(0, Math.floor(normalizeNumber(candidate.hitstunMs) ?? 0)),
    targetHealth: Math.max(0, Math.floor(normalizeNumber(candidate.targetHealth) ?? 0))
  };
}

export function normalizeCombatBlockPayload(payload: unknown): MatchCombatBlockPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatBlockPayload>;
  const attackerSessionId = normalizeText(candidate.attackerSessionId);
  const targetSessionId = normalizeText(candidate.targetSessionId);
  const comboHitIndex = normalizeNumber(candidate.comboHitIndex);
  const guardDamage = normalizeNumber(candidate.guardDamage);
  const currentGuard = normalizeNumber(candidate.currentGuard);
  const maxGuard = normalizeNumber(candidate.maxGuard);
  const didGuardBreak = normalizeBoolean(candidate.didGuardBreak);

  if (
    !attackerSessionId ||
    !targetSessionId ||
    comboHitIndex === null ||
    guardDamage === null ||
    currentGuard === null ||
    maxGuard === null ||
    didGuardBreak === null
  ) {
    return null;
  }

  return {
    attackerSessionId,
    targetSessionId,
    comboHitIndex: Math.max(1, Math.min(3, Math.floor(comboHitIndex))),
    guardDamage: Math.max(0, Math.floor(guardDamage)),
    currentGuard: Math.max(0, currentGuard),
    maxGuard: Math.max(1, maxGuard),
    didGuardBreak
  };
}

export function normalizeCombatGuardBreakPayload(payload: unknown): MatchCombatGuardBreakPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatGuardBreakPayload>;
  const attackerSessionId = normalizeText(candidate.attackerSessionId);
  const targetSessionId = normalizeText(candidate.targetSessionId);
  const guardBreakDurationMs = normalizeNumber(candidate.guardBreakDurationMs);

  if (!attackerSessionId || !targetSessionId || guardBreakDurationMs === null) {
    return null;
  }

  return {
    attackerSessionId,
    targetSessionId,
    guardBreakDurationMs: Math.max(0, Math.floor(guardBreakDurationMs))
  };
}

export function normalizeCombatStatePayload(payload: unknown): MatchCombatStatePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatStatePayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const combatState =
    typeof candidate.combatState === "string" ? candidate.combatState : null;
  const combatStateStartedAt = normalizeNumber(candidate.combatStateStartedAt);
  const combatStateEndsAt = normalizeNumber(candidate.combatStateEndsAt);
  const attackPhase = typeof candidate.attackPhase === "string" ? candidate.attackPhase : null;
  const activeActionId = normalizeText(candidate.activeActionId) ?? "";
  const activeSkillId = normalizeText(candidate.activeSkillId) ?? "";
  const isAttacking = normalizeBoolean(candidate.isAttacking);
  const attackComboIndex = normalizeNumber(candidate.attackComboIndex);
  const lastAttackAt = normalizeNumber(candidate.lastAttackAt);
  const queuedAttack = normalizeBoolean(candidate.queuedAttack);
  const currentHealth = normalizeNumber(candidate.currentHealth);
  const maxHealth = normalizeNumber(candidate.maxHealth);
  const isAlive = normalizeBoolean(candidate.isAlive);
  const lastDamagedAt = normalizeNumber(candidate.lastDamagedAt);
  const deadAt = normalizeNumber(candidate.deadAt);
  const respawnAvailableAt = normalizeNumber(candidate.respawnAvailableAt);
  const skillCooldowns = normalizeRecordOfNumbers(candidate.skillCooldowns);
  const isBlocking = normalizeBoolean(candidate.isBlocking);
  const blockStartedAt = normalizeNumber(candidate.blockStartedAt);
  const maxGuard = normalizeNumber(candidate.maxGuard);
  const currentGuard = normalizeNumber(candidate.currentGuard);
  const isGuardBroken = normalizeBoolean(candidate.isGuardBroken);
  const stunUntil = normalizeNumber(candidate.stunUntil);
  const lastGuardDamagedAt = normalizeNumber(candidate.lastGuardDamagedAt);
  const x = normalizeNumber(candidate.x);
  const y = normalizeNumber(candidate.y);
  const z = normalizeNumber(candidate.z);

  if (
    !sessionId ||
    !combatState ||
    combatStateStartedAt === null ||
    combatStateEndsAt === null ||
    !attackPhase ||
    isAttacking === null ||
    attackComboIndex === null ||
    lastAttackAt === null ||
    queuedAttack === null ||
    currentHealth === null ||
    maxHealth === null ||
    isAlive === null ||
    lastDamagedAt === null ||
    deadAt === null ||
    respawnAvailableAt === null ||
    isBlocking === null ||
    blockStartedAt === null ||
    maxGuard === null ||
    currentGuard === null ||
    isGuardBroken === null ||
    stunUntil === null ||
    lastGuardDamagedAt === null ||
    x === null ||
    y === null ||
    z === null
  ) {
    return null;
  }

  return {
    sessionId,
    combatState: combatState as MatchCombatStatePayload["combatState"],
    combatStateStartedAt,
    combatStateEndsAt,
    attackPhase: attackPhase as MatchCombatStatePayload["attackPhase"],
    activeActionId,
    activeSkillId,
    isAttacking,
    attackComboIndex: Math.max(0, Math.min(3, Math.floor(attackComboIndex))),
    lastAttackAt,
    queuedAttack,
    currentHealth: Math.max(0, Math.floor(currentHealth)),
    maxHealth: Math.max(1, Math.floor(maxHealth)),
    isAlive,
    lastDamagedAt,
    deadAt,
    respawnAvailableAt,
    skillCooldowns,
    isBlocking,
    blockStartedAt,
    maxGuard: Math.max(1, maxGuard),
    currentGuard: Math.max(0, currentGuard),
    isGuardBroken,
    stunUntil,
    lastGuardDamagedAt,
    x,
    y,
    z
  };
}

export function normalizeSkillCastStartedPayload(payload: unknown): MatchSkillCastStartedEventPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchSkillCastStartedEventPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const skillId = normalizeText(candidate.skillId);
  const skillSlot = normalizeNumber(candidate.skillSlot);
  const startedAt = normalizeNumber(candidate.startedAt);
  const endsAt = normalizeNumber(candidate.endsAt);
  const cooldownEndsAt = normalizeNumber(candidate.cooldownEndsAt);
  const isUltimate = normalizeBoolean(candidate.isUltimate);
  if (
    !sessionId ||
    !skillId ||
    skillSlot === null ||
    startedAt === null ||
    endsAt === null ||
    cooldownEndsAt === null ||
    isUltimate === null
  ) {
    return null;
  }

  return {
    sessionId,
    skillId,
    skillSlot: Math.max(1, Math.min(5, Math.floor(skillSlot))),
    startedAt,
    endsAt,
    cooldownEndsAt,
    isUltimate
  };
}

export function normalizeSkillCastFinishedPayload(payload: unknown): MatchSkillCastFinishedEventPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchSkillCastFinishedEventPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const skillId = normalizeText(candidate.skillId);
  const finishedAt = normalizeNumber(candidate.finishedAt);
  if (!sessionId || !skillId || finishedAt === null) {
    return null;
  }

  return {
    sessionId,
    skillId,
    finishedAt
  };
}

export function normalizeCombatPlayerDiedPayload(payload: unknown): MatchCombatPlayerDiedPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatPlayerDiedPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const killerSessionId =
    candidate.killerSessionId === null ? null : normalizeText(candidate.killerSessionId);
  const deadAt = normalizeNumber(candidate.deadAt);
  const respawnAvailableAt = normalizeNumber(candidate.respawnAvailableAt);
  if (!sessionId || deadAt === null || respawnAvailableAt === null) {
    return null;
  }

  return {
    sessionId,
    killerSessionId,
    deadAt,
    respawnAvailableAt
  };
}

export function normalizeCombatRagdollPayload(payload: unknown): MatchCombatRagdollPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatRagdollPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const enabledAt = normalizeNumber(candidate.enabledAt);
  if (!sessionId || enabledAt === null) {
    return null;
  }

  return {
    sessionId,
    enabledAt
  };
}

export function normalizeCombatKillPayload(payload: unknown): MatchCombatKillPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatKillPayload>;
  const killerSessionId = normalizeText(candidate.killerSessionId);
  const victimSessionId = normalizeText(candidate.victimSessionId);
  const killerName = normalizeText(candidate.killerName);
  const victimName = normalizeText(candidate.victimName);
  const killerKills = normalizeNumber(candidate.killerKills);
  const victimDeaths = normalizeNumber(candidate.victimDeaths);
  const timestamp = normalizeNumber(candidate.timestamp);

  if (
    !killerSessionId ||
    !victimSessionId ||
    !killerName ||
    !victimName ||
    killerKills === null ||
    victimDeaths === null ||
    timestamp === null
  ) {
    return null;
  }

  return {
    killerSessionId,
    victimSessionId,
    killerName,
    victimName,
    killerKills: Math.max(0, Math.floor(killerKills)),
    victimDeaths: Math.max(0, Math.floor(victimDeaths)),
    timestamp
  };
}

export function normalizeCombatUltimatePayload(payload: unknown): MatchCombatUltimatePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatUltimatePayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const characterId = normalizeText(candidate.characterId);
  const skillId = normalizeText(candidate.skillId) ?? "ultimate";
  const durationMs = normalizeNumber(candidate.durationMs);
  const startedAt = normalizeNumber(candidate.startedAt);
  const endsAt = normalizeNumber(candidate.endsAt);

  if (
    !sessionId ||
    !characterId ||
    durationMs === null ||
    startedAt === null ||
    endsAt === null
  ) {
    return null;
  }

  return {
    sessionId,
    characterId,
    skillId,
    durationMs: Math.max(0, Math.floor(durationMs)),
    startedAt,
    endsAt
  };
}
