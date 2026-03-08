// Responsável por sincronizar estado autoritativo de jogadores da global_match e expor eventos por sessionId.
import { Client, Room } from "@colyseus/sdk";
import { resolveServerEndpoint } from "../config/server-endpoint";
import type {
  MatchCombatBlockPayload,
  MatchCombatGuardBreakPayload,
  MatchCombatHitPayload,
  MatchCombatKillPayload,
  MatchCombatStatePayload,
  MatchCombatUltimatePayload,
  MatchPlayerMovedPayload,
  MatchPlayerJoinedPayload,
  MatchPlayerLeftPayload,
  MatchPlayerState,
  MatchSnapshotPayload
} from "../models/match-player.model";

export const GLOBAL_MATCH_ROOM_NAME = "global_match";
const MATCH_SNAPSHOT_REQUEST_EVENT = "match:snapshot:request";
const MATCH_SNAPSHOT_EVENT = "match:snapshot";
const MATCH_PLAYER_JOINED_EVENT = "match:player:joined";
const MATCH_PLAYER_LEFT_EVENT = "match:player:left";
const MATCH_PLAYER_MOVED_EVENT = "match:player:moved";
const MATCH_PLAYER_MOVE_EVENT = "player_move";
const MATCH_PLAYER_SPRINT_INTENT_EVENT = "player:sprint:intent";
const MATCH_ULTIMATE_ACTIVATE_EVENT = "ultimate:activate";
const MATCH_ATTACK_START_EVENT = "attack:start";
const MATCH_BLOCK_START_EVENT = "block:start";
const MATCH_BLOCK_END_EVENT = "block:end";
const MATCH_PLAYER_RESPAWN_EVENT = "player:respawn";
const MATCH_COMBAT_HIT_EVENT = "combat:hit";
const MATCH_COMBAT_BLOCK_EVENT = "combat:block";
const MATCH_COMBAT_GUARD_BREAK_EVENT = "combat:guardBreak";
const MATCH_COMBAT_KILL_EVENT = "combat:kill";
const MATCH_COMBAT_ULTIMATE_EVENT = "combat:ultimate";
const MATCH_COMBAT_STATE_EVENT = "combat:state";
const DEFAULT_MAX_HEALTH = 1000;
const DEFAULT_ULTIMATE_MAX = 100;
const DEFAULT_MAX_STAMINA = 100;
const DEFAULT_MAX_GUARD = 100;
const DEFAULT_SCORE_VALUE = 0;

export type MatchIdentity = {
  userId: string;
  nickname: string;
  heroId: string;
};

export type MatchServiceOptions = {
  endpoint?: string;
  roomName?: string;
  getIdentity: () => MatchIdentity | null;
};

export type MatchService = {
  connect: () => Promise<void>;
  disconnect: () => void;
  getLocalSessionId: () => string | null;
  getPlayers: () => MatchPlayerState[];
  onPlayersChanged: (callback: (players: MatchPlayerState[]) => void) => () => void;
  onPlayerAdded: (callback: (player: MatchPlayerState) => void) => () => void;
  onPlayerUpdated: (callback: (player: MatchPlayerState) => void) => () => void;
  onPlayerRemoved: (callback: (sessionId: string) => void) => () => void;
  onCombatHit: (callback: (payload: MatchCombatHitPayload) => void) => () => void;
  onCombatBlock: (callback: (payload: MatchCombatBlockPayload) => void) => () => void;
  onCombatGuardBreak: (callback: (payload: MatchCombatGuardBreakPayload) => void) => () => void;
  onCombatKill: (callback: (payload: MatchCombatKillPayload) => void) => () => void;
  onCombatUltimate: (callback: (payload: MatchCombatUltimatePayload) => void) => () => void;
  onCombatState: (callback: (payload: MatchCombatStatePayload) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
  sendLocalMovement: (movement: { x: number; y: number; z: number; rotationY: number }) => void;
  sendSprintIntent: (intent: { isShiftPressed: boolean; isForwardPressed: boolean }) => void;
  sendUltimateActivate: () => void;
  sendAttackStart: () => void;
  sendBlockStart: () => void;
  sendBlockEnd: () => void;
  sendRespawnRequest: () => void;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeIdentity(identity: MatchIdentity | null): MatchIdentity | null {
  if (!identity) {
    return null;
  }

  const userId = normalizeText(identity.userId);
  const nickname = normalizeText(identity.nickname);
  const heroId = normalizeText(identity.heroId);

  if (!userId || !nickname || !heroId) {
    return null;
  }

  return {
    userId,
    nickname,
    heroId
  };
}

function normalizePlayer(value: unknown): MatchPlayerState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MatchPlayerState>;
  const sessionId = normalizeText(candidate.sessionId);
  const userId = normalizeText(candidate.userId);
  const nickname = normalizeText(candidate.nickname);
  const heroId = normalizeText(candidate.heroId);
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
  const sprintBlocked = normalizeBoolean(candidate.sprintBlocked) ?? currentStamina <= 0;
  const isAttacking = normalizeBoolean(candidate.isAttacking) ?? false;
  const attackComboIndex = normalizeNumber(candidate.attackComboIndex) ?? 0;
  const lastAttackAt = normalizeNumber(candidate.lastAttackAt) ?? 0;
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
    sprintBlocked: safeSprintBlocked,
    lastSprintEndedAt,
    isAttacking: safeIsAlive ? isAttacking : false,
    attackComboIndex: safeAttackComboIndex,
    lastAttackAt,
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

function normalizeSnapshot(payload: unknown): MatchPlayerState[] {
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

function normalizeJoinedPayload(payload: unknown): MatchPlayerState | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerJoinedPayload>;
  return normalizePlayer(candidate.player);
}

function normalizeLeftPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerLeftPayload>;
  return normalizeText(candidate.sessionId);
}

function normalizeMovedPayload(payload: unknown): MatchPlayerMovedPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchPlayerMovedPayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const x = normalizeNumber(candidate.x);
  const y = normalizeNumber(candidate.y);
  const z = normalizeNumber(candidate.z);
  const rotationY = normalizeNumber(candidate.rotationY);

  if (!sessionId || x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  return { sessionId, x, y, z, rotationY };
}

function normalizeCombatHitPayload(payload: unknown): MatchCombatHitPayload | null {
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
    damage: Math.max(0, Math.floor(damage)),
    comboHitIndex: Math.max(1, Math.min(3, Math.floor(comboHitIndex))),
    wasBlocked,
    didGuardBreak
  };
}

function normalizeCombatBlockPayload(payload: unknown): MatchCombatBlockPayload | null {
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

function normalizeCombatGuardBreakPayload(payload: unknown): MatchCombatGuardBreakPayload | null {
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

function normalizeCombatStatePayload(payload: unknown): MatchCombatStatePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatStatePayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const isAttacking = normalizeBoolean(candidate.isAttacking);
  const attackComboIndex = normalizeNumber(candidate.attackComboIndex);
  const lastAttackAt = normalizeNumber(candidate.lastAttackAt);
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
    isAttacking === null ||
    attackComboIndex === null ||
    lastAttackAt === null ||
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
    isAttacking,
    attackComboIndex: Math.max(0, Math.min(3, Math.floor(attackComboIndex))),
    lastAttackAt,
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

function normalizeCombatKillPayload(payload: unknown): MatchCombatKillPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatKillPayload>;
  const killerSessionId = normalizeText(candidate.killerSessionId);
  const victimSessionId = normalizeText(candidate.victimSessionId);
  const killerKills = normalizeNumber(candidate.killerKills);
  const victimDeaths = normalizeNumber(candidate.victimDeaths);

  if (!killerSessionId || !victimSessionId || killerKills === null || victimDeaths === null) {
    return null;
  }

  return {
    killerSessionId,
    victimSessionId,
    killerKills: Math.max(0, Math.floor(killerKills)),
    victimDeaths: Math.max(0, Math.floor(victimDeaths))
  };
}

function normalizeCombatUltimatePayload(payload: unknown): MatchCombatUltimatePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MatchCombatUltimatePayload>;
  const sessionId = normalizeText(candidate.sessionId);
  const characterId = normalizeText(candidate.characterId);
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
    durationMs: Math.max(0, Math.floor(durationMs)),
    startedAt,
    endsAt
  };
}

function clonePlayer(player: MatchPlayerState): MatchPlayerState {
  return {
    sessionId: player.sessionId,
    userId: player.userId,
    nickname: player.nickname,
    heroId: player.heroId,
    x: player.x,
    y: player.y,
    z: player.z,
    rotationY: player.rotationY,
    kills: player.kills,
    deaths: player.deaths,
    maxHealth: player.maxHealth,
    currentHealth: player.currentHealth,
    isAlive: player.isAlive,
    ultimateCharge: player.ultimateCharge,
    ultimateMax: player.ultimateMax,
    isUltimateReady: player.isUltimateReady,
    isUsingUltimate: player.isUsingUltimate,
    ultimateStartedAt: player.ultimateStartedAt,
    ultimateEndsAt: player.ultimateEndsAt,
    maxStamina: player.maxStamina,
    currentStamina: player.currentStamina,
    isSprinting: player.isSprinting,
    sprintBlocked: player.sprintBlocked,
    lastSprintEndedAt: player.lastSprintEndedAt,
    isAttacking: player.isAttacking,
    attackComboIndex: player.attackComboIndex,
    lastAttackAt: player.lastAttackAt,
    isBlocking: player.isBlocking,
    blockStartedAt: player.blockStartedAt,
    maxGuard: player.maxGuard,
    currentGuard: player.currentGuard,
    isGuardBroken: player.isGuardBroken,
    stunUntil: player.stunUntil,
    lastGuardDamagedAt: player.lastGuardDamagedAt,
    joinedAt: player.joinedAt
  };
}

export function createMatchService(options: MatchServiceOptions): MatchService {
  const endpoint = options.endpoint ?? resolveServerEndpoint();
  const roomName = options.roomName ?? GLOBAL_MATCH_ROOM_NAME;

  const client = new Client(endpoint);
  let room: Room | null = null;
  let connectPromise: Promise<void> | null = null;
  let suppressNextDisconnectError = false;
  let connectedIdentity: MatchIdentity | null = null;

  const playersBySessionId = new Map<string, MatchPlayerState>();

  const playersChangedListeners = new Set<(players: MatchPlayerState[]) => void>();
  const playerAddedListeners = new Set<(player: MatchPlayerState) => void>();
  const playerUpdatedListeners = new Set<(player: MatchPlayerState) => void>();
  const playerRemovedListeners = new Set<(sessionId: string) => void>();
  const combatHitListeners = new Set<(payload: MatchCombatHitPayload) => void>();
  const combatBlockListeners = new Set<(payload: MatchCombatBlockPayload) => void>();
  const combatGuardBreakListeners = new Set<(payload: MatchCombatGuardBreakPayload) => void>();
  const combatKillListeners = new Set<(payload: MatchCombatKillPayload) => void>();
  const combatUltimateListeners = new Set<(payload: MatchCombatUltimatePayload) => void>();
  const combatStateListeners = new Set<(payload: MatchCombatStatePayload) => void>();
  const errorListeners = new Set<(error: Error) => void>();

  const emitPlayersChanged = (): void => {
    const snapshot = Array.from(playersBySessionId.values()).map((player) => clonePlayer(player));
    playersChangedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerAdded = (player: MatchPlayerState): void => {
    const snapshot = clonePlayer(player);
    playerAddedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerUpdated = (player: MatchPlayerState): void => {
    const snapshot = clonePlayer(player);
    playerUpdatedListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPlayerRemoved = (sessionId: string): void => {
    playerRemovedListeners.forEach((listener) => {
      listener(sessionId);
    });
  };

  const emitCombatHit = (payload: MatchCombatHitPayload): void => {
    combatHitListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatBlock = (payload: MatchCombatBlockPayload): void => {
    combatBlockListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatGuardBreak = (payload: MatchCombatGuardBreakPayload): void => {
    combatGuardBreakListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatKill = (payload: MatchCombatKillPayload): void => {
    combatKillListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatUltimate = (payload: MatchCombatUltimatePayload): void => {
    combatUltimateListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitCombatState = (payload: MatchCombatStatePayload): void => {
    combatStateListeners.forEach((listener) => {
      listener(payload);
    });
  };

  const emitError = (error: Error): void => {
    errorListeners.forEach((listener) => {
      listener(error);
    });
  };

  const applySnapshot = (players: MatchPlayerState[]): void => {
    const incomingBySessionId = new Map<string, MatchPlayerState>();
    players.forEach((player) => {
      incomingBySessionId.set(player.sessionId, player);
    });

    playersBySessionId.forEach((existingPlayer, sessionId) => {
      if (incomingBySessionId.has(sessionId)) {
        return;
      }

      playersBySessionId.delete(sessionId);
      emitPlayerRemoved(sessionId);
    });

    incomingBySessionId.forEach((incomingPlayer, sessionId) => {
      const existingPlayer = playersBySessionId.get(sessionId);
      if (!existingPlayer) {
        playersBySessionId.set(sessionId, incomingPlayer);
        emitPlayerAdded(incomingPlayer);
        return;
      }

      const changed =
        existingPlayer.x !== incomingPlayer.x ||
        existingPlayer.y !== incomingPlayer.y ||
        existingPlayer.z !== incomingPlayer.z ||
        existingPlayer.rotationY !== incomingPlayer.rotationY ||
        existingPlayer.kills !== incomingPlayer.kills ||
        existingPlayer.deaths !== incomingPlayer.deaths ||
        existingPlayer.nickname !== incomingPlayer.nickname ||
        existingPlayer.heroId !== incomingPlayer.heroId ||
        existingPlayer.maxHealth !== incomingPlayer.maxHealth ||
        existingPlayer.currentHealth !== incomingPlayer.currentHealth ||
        existingPlayer.isAlive !== incomingPlayer.isAlive ||
        existingPlayer.ultimateCharge !== incomingPlayer.ultimateCharge ||
        existingPlayer.ultimateMax !== incomingPlayer.ultimateMax ||
        existingPlayer.isUltimateReady !== incomingPlayer.isUltimateReady ||
        existingPlayer.isUsingUltimate !== incomingPlayer.isUsingUltimate ||
        existingPlayer.ultimateStartedAt !== incomingPlayer.ultimateStartedAt ||
        existingPlayer.ultimateEndsAt !== incomingPlayer.ultimateEndsAt ||
        existingPlayer.maxStamina !== incomingPlayer.maxStamina ||
        existingPlayer.currentStamina !== incomingPlayer.currentStamina ||
        existingPlayer.isSprinting !== incomingPlayer.isSprinting ||
        existingPlayer.sprintBlocked !== incomingPlayer.sprintBlocked ||
        existingPlayer.lastSprintEndedAt !== incomingPlayer.lastSprintEndedAt ||
        existingPlayer.isAttacking !== incomingPlayer.isAttacking ||
        existingPlayer.attackComboIndex !== incomingPlayer.attackComboIndex ||
        existingPlayer.lastAttackAt !== incomingPlayer.lastAttackAt ||
        existingPlayer.isBlocking !== incomingPlayer.isBlocking ||
        existingPlayer.blockStartedAt !== incomingPlayer.blockStartedAt ||
        existingPlayer.maxGuard !== incomingPlayer.maxGuard ||
        existingPlayer.currentGuard !== incomingPlayer.currentGuard ||
        existingPlayer.isGuardBroken !== incomingPlayer.isGuardBroken ||
        existingPlayer.stunUntil !== incomingPlayer.stunUntil ||
        existingPlayer.lastGuardDamagedAt !== incomingPlayer.lastGuardDamagedAt;

      if (changed) {
        playersBySessionId.set(sessionId, incomingPlayer);
        emitPlayerUpdated(incomingPlayer);
      }
    });

    emitPlayersChanged();
  };

  const bindRoomEvents = (connectedRoom: Room): void => {
    connectedRoom.onMessage(MATCH_SNAPSHOT_EVENT, (payload: unknown) => {
      applySnapshot(normalizeSnapshot(payload));
    });

    connectedRoom.onMessage(MATCH_PLAYER_JOINED_EVENT, (payload: unknown) => {
      const joinedPlayer = normalizeJoinedPayload(payload);
      if (!joinedPlayer) {
        return;
      }

      playersBySessionId.set(joinedPlayer.sessionId, joinedPlayer);
      emitPlayerAdded(joinedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(MATCH_PLAYER_LEFT_EVENT, (payload: unknown) => {
      const sessionId = normalizeLeftPayload(payload);
      if (!sessionId) {
        return;
      }

      const didDelete = playersBySessionId.delete(sessionId);
      if (!didDelete) {
        return;
      }

      emitPlayerRemoved(sessionId);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(MATCH_PLAYER_MOVED_EVENT, (payload: unknown) => {
      const movedPlayer = normalizeMovedPayload(payload);
      if (!movedPlayer) {
        return;
      }

      const existingPlayer = playersBySessionId.get(movedPlayer.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        x: movedPlayer.x,
        y: movedPlayer.y,
        z: movedPlayer.z,
        rotationY: movedPlayer.rotationY
      };

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(MATCH_COMBAT_HIT_EVENT, (payload: unknown) => {
      const hitPayload = normalizeCombatHitPayload(payload);
      if (!hitPayload) {
        return;
      }

      emitCombatHit(hitPayload);
    });

    connectedRoom.onMessage(MATCH_COMBAT_BLOCK_EVENT, (payload: unknown) => {
      const blockPayload = normalizeCombatBlockPayload(payload);
      if (!blockPayload) {
        return;
      }

      emitCombatBlock(blockPayload);
    });

    connectedRoom.onMessage(MATCH_COMBAT_GUARD_BREAK_EVENT, (payload: unknown) => {
      const guardBreakPayload = normalizeCombatGuardBreakPayload(payload);
      if (!guardBreakPayload) {
        return;
      }

      emitCombatGuardBreak(guardBreakPayload);
    });

    connectedRoom.onMessage(MATCH_COMBAT_KILL_EVENT, (payload: unknown) => {
      const killPayload = normalizeCombatKillPayload(payload);
      if (!killPayload) {
        return;
      }

      const killer = playersBySessionId.get(killPayload.killerSessionId);
      if (killer) {
        playersBySessionId.set(killer.sessionId, {
          ...killer,
          kills: killPayload.killerKills
        });
      }

      const victim = playersBySessionId.get(killPayload.victimSessionId);
      if (victim) {
        playersBySessionId.set(victim.sessionId, {
          ...victim,
          deaths: killPayload.victimDeaths
        });
      }

      emitCombatKill(killPayload);
      emitPlayersChanged();
    });

    connectedRoom.onMessage(MATCH_COMBAT_ULTIMATE_EVENT, (payload: unknown) => {
      const ultimatePayload = normalizeCombatUltimatePayload(payload);
      if (!ultimatePayload) {
        return;
      }

      const player = playersBySessionId.get(ultimatePayload.sessionId);
      if (player) {
        const updatedPlayer: MatchPlayerState = {
          ...player,
          isUsingUltimate: true,
          ultimateStartedAt: ultimatePayload.startedAt,
          ultimateEndsAt: ultimatePayload.endsAt
        };

        playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
        emitPlayerUpdated(updatedPlayer);
        emitPlayersChanged();
      }

      emitCombatUltimate(ultimatePayload);
    });

    connectedRoom.onMessage(MATCH_COMBAT_STATE_EVENT, (payload: unknown) => {
      const combatStatePayload = normalizeCombatStatePayload(payload);
      if (!combatStatePayload) {
        return;
      }

      const existingPlayer = playersBySessionId.get(combatStatePayload.sessionId);
      if (!existingPlayer) {
        return;
      }

      const updatedPlayer: MatchPlayerState = {
        ...existingPlayer,
        isAttacking: combatStatePayload.isAttacking,
        attackComboIndex: combatStatePayload.attackComboIndex,
        lastAttackAt: combatStatePayload.lastAttackAt,
        isBlocking: combatStatePayload.isBlocking,
        blockStartedAt: combatStatePayload.blockStartedAt,
        maxGuard: combatStatePayload.maxGuard,
        currentGuard: clamp(combatStatePayload.currentGuard, 0, combatStatePayload.maxGuard),
        isGuardBroken: combatStatePayload.isGuardBroken,
        stunUntil: combatStatePayload.stunUntil,
        lastGuardDamagedAt: combatStatePayload.lastGuardDamagedAt,
        x: combatStatePayload.x,
        y: combatStatePayload.y,
        z: combatStatePayload.z
      };

      playersBySessionId.set(updatedPlayer.sessionId, updatedPlayer);
      emitCombatState(combatStatePayload);
      emitPlayerUpdated(updatedPlayer);
      emitPlayersChanged();
    });

    connectedRoom.onLeave(() => {
      room = null;
      playersBySessionId.clear();
      emitPlayersChanged();

      if (suppressNextDisconnectError) {
        suppressNextDisconnectError = false;
        return;
      }

      emitError(new Error("Conexão com a partida global foi encerrada."));
    });

    connectedRoom.onError((code, message) => {
      const errorMessage = message ?? `Falha ao conectar na partida global (code: ${String(code)}).`;
      emitError(new Error(errorMessage));
    });
  };

  return {
    connect: async () => {
      if (connectPromise) {
        return connectPromise;
      }

      connectPromise = (async () => {
        const identity = normalizeIdentity(options.getIdentity());
        if (!identity) {
          throw new Error("Perfil local inválido para entrar na partida global.");
        }

        if (
          room &&
          connectedIdentity &&
          connectedIdentity.userId === identity.userId &&
          connectedIdentity.nickname === identity.nickname &&
          connectedIdentity.heroId === identity.heroId
        ) {
          return;
        }

        if (room) {
          suppressNextDisconnectError = true;
          room.leave();
          room = null;
          connectedIdentity = null;
          playersBySessionId.clear();
          emitPlayersChanged();
        }

        const connectedRoom = await client.joinOrCreate(roomName, {
          userId: identity.userId,
          nickname: identity.nickname,
          heroId: identity.heroId
        });

        room = connectedRoom;
        connectedIdentity = identity;
        bindRoomEvents(connectedRoom);
        connectedRoom.send(MATCH_SNAPSHOT_REQUEST_EVENT);
      })();

      try {
        await connectPromise;
      } catch (error) {
        emitError(error instanceof Error ? error : new Error("Falha inesperada ao conectar na partida."));
        throw error;
      } finally {
        connectPromise = null;
      }
    },
    disconnect: () => {
      if (!room) {
        connectedIdentity = null;
        playersBySessionId.clear();
        emitPlayersChanged();
        return;
      }

      suppressNextDisconnectError = true;
      room.leave();
      room = null;
      connectedIdentity = null;
      playersBySessionId.clear();
      emitPlayersChanged();
    },
    getLocalSessionId: () => {
      return room?.sessionId ?? null;
    },
    getPlayers: () => {
      return Array.from(playersBySessionId.values()).map((player) => clonePlayer(player));
    },
    onPlayersChanged: (callback) => {
      playersChangedListeners.add(callback);
      callback(Array.from(playersBySessionId.values()).map((player) => clonePlayer(player)));

      return () => {
        playersChangedListeners.delete(callback);
      };
    },
    onPlayerAdded: (callback) => {
      playerAddedListeners.add(callback);
      return () => {
        playerAddedListeners.delete(callback);
      };
    },
    onPlayerUpdated: (callback) => {
      playerUpdatedListeners.add(callback);
      return () => {
        playerUpdatedListeners.delete(callback);
      };
    },
    onPlayerRemoved: (callback) => {
      playerRemovedListeners.add(callback);
      return () => {
        playerRemovedListeners.delete(callback);
      };
    },
    onCombatHit: (callback) => {
      combatHitListeners.add(callback);
      return () => {
        combatHitListeners.delete(callback);
      };
    },
    onCombatBlock: (callback) => {
      combatBlockListeners.add(callback);
      return () => {
        combatBlockListeners.delete(callback);
      };
    },
    onCombatGuardBreak: (callback) => {
      combatGuardBreakListeners.add(callback);
      return () => {
        combatGuardBreakListeners.delete(callback);
      };
    },
    onCombatKill: (callback) => {
      combatKillListeners.add(callback);
      return () => {
        combatKillListeners.delete(callback);
      };
    },
    onCombatUltimate: (callback) => {
      combatUltimateListeners.add(callback);
      return () => {
        combatUltimateListeners.delete(callback);
      };
    },
    onCombatState: (callback) => {
      combatStateListeners.add(callback);
      return () => {
        combatStateListeners.delete(callback);
      };
    },
    onError: (callback) => {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    sendLocalMovement: (movement) => {
      if (!room) {
        return;
      }

      room.send(MATCH_PLAYER_MOVE_EVENT, {
        x: movement.x,
        y: movement.y,
        z: movement.z,
        rotationY: movement.rotationY
      });
    },
    sendSprintIntent: (intent) => {
      if (!room) {
        return;
      }

      room.send(MATCH_PLAYER_SPRINT_INTENT_EVENT, {
        isShiftPressed: intent.isShiftPressed,
        isForwardPressed: intent.isForwardPressed
      });
    },
    sendUltimateActivate: () => {
      if (!room) {
        return;
      }

      room.send(MATCH_ULTIMATE_ACTIVATE_EVENT, {});
    },
    sendAttackStart: () => {
      if (!room) {
        return;
      }

      room.send(MATCH_ATTACK_START_EVENT, {});
    },
    sendBlockStart: () => {
      if (!room) {
        return;
      }

      room.send(MATCH_BLOCK_START_EVENT, {});
    },
    sendBlockEnd: () => {
      if (!room) {
        return;
      }

      room.send(MATCH_BLOCK_END_EVENT, {});
    },
    sendRespawnRequest: () => {
      if (!room) {
        return;
      }

      room.send(MATCH_PLAYER_RESPAWN_EVENT, {});
    }
  };
}
