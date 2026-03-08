// Responsável por manter estado autoritativo de jogadores da global_match, incluindo movimento, stamina, combate e sincronização.
import { Client, Room } from "@colyseus/core";
import type {
  GlobalMatchState,
  MatchAttackStartPayload,
  MatchBlockEndPayload,
  MatchBlockStartPayload,
  MatchJoinOptions,
  MatchMovePayload,
  MatchPlayerState,
  MatchRespawnRequestPayload,
  MatchSprintIntentPayload,
  MatchUltimateActivatePayload
} from "../models/match-player.model.js";
import { resolveHeroCombatServerConfig, VALID_HERO_IDS } from "../config/hero-combat.config.js";
import { resetHealth } from "../services/health.service.js";
import {
  applyAuthoritativeMovementValidation,
  initializePlayerMovementState,
  type PlayerMovementState
} from "../services/movement-state.service.js";
import { SpawnService } from "../services/spawn.service.js";
import {
  initializeStamina,
  updateSprintState,
  type SprintInputState
} from "../services/stamina.service.js";
import {
  addUltimateCharge,
  consumeUltimate,
  resetUltimate,
  syncUltimateReady
} from "../services/ultimate.service.js";
import { initializeGuardState } from "../services/block-guard.service.js";
import {
  handleAttackStart,
  handleBlockEnd,
  handleBlockStart,
  tickCombatState
} from "../services/combat.service.js";

const DEFAULT_HERO_ID = "user";
const MAX_NICKNAME_LENGTH = 24;
const MATCH_SNAPSHOT_REQUEST_EVENT = "match:snapshot:request";
const MATCH_SNAPSHOT_EVENT = "match:snapshot";
const MATCH_PLAYER_JOINED_EVENT = "match:player:joined";
const MATCH_PLAYER_LEFT_EVENT = "match:player:left";
const MATCH_PLAYER_MOVE_EVENT = "player_move";
const MATCH_PLAYER_MOVED_EVENT = "match:player:moved";
const MATCH_PLAYER_SPRINT_INTENT_EVENT = "player:sprint:intent";
const MATCH_ULTIMATE_ACTIVATE_EVENT = "ultimate:activate";
const MATCH_ATTACK_START_EVENT = "attack:start";
const MATCH_BLOCK_START_EVENT = "block:start";
const MATCH_BLOCK_END_EVENT = "block:end";
const MATCH_PLAYER_RESPAWN_EVENT = "player:respawn";
const MATCH_COMBAT_HIT_EVENT = "combat:hit";
const MATCH_COMBAT_BLOCK_EVENT = "combat:block";
const MATCH_COMBAT_GUARD_BREAK_EVENT = "combat:guardBreak";
const MATCH_COMBAT_STATE_EVENT = "combat:state";
const MATCH_STATE_SYNC_INTERVAL_MS = 50;
const MATCH_SPRINT_TICK_INTERVAL_MS = 50;
const MATCH_MAX_SPRINT_DELTA_SECONDS = 0.2;
const MATCH_ULTIMATE_AUTO_CHARGE_INTERVAL_MS = 2000;
const MATCH_ULTIMATE_AUTO_CHARGE_AMOUNT = 5;
const PLAYER_COLLISION_RADIUS = 0.44;
const PLAYER_COLLISION_HEIGHT = 2.4;
const PLAYER_COLLISION_MIN_DISTANCE = PLAYER_COLLISION_RADIUS * 2;
const PLAYER_COLLISION_MIN_DISTANCE_SQUARED = PLAYER_COLLISION_MIN_DISTANCE * PLAYER_COLLISION_MIN_DISTANCE;
const PLAYER_COLLISION_EPSILON = 0.000001;
const PLAYER_COLLISION_RESOLVE_PASSES = 5;

type PlayerCombatSnapshot = {
  isAttacking: boolean;
  attackComboIndex: number;
  lastAttackAt: number;
  isBlocking: boolean;
  blockStartedAt: number;
  currentGuard: number;
  isGuardBroken: boolean;
  stunUntil: number;
  lastGuardDamagedAt: number;
  x: number;
  y: number;
  z: number;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNickname(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_NICKNAME_LENGTH);
}

function normalizeHeroId(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return DEFAULT_HERO_ID;
  }

  return VALID_HERO_IDS.has(normalized) ? normalized : DEFAULT_HERO_ID;
}

function normalizePositionValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeBooleanValue(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

function normalizeRotationValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
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
    maxHealth: player.maxHealth,
    currentHealth: player.currentHealth,
    isAlive: player.isAlive,
    ultimateCharge: player.ultimateCharge,
    ultimateMax: player.ultimateMax,
    isUltimateReady: player.isUltimateReady,
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

function cloneState(state: GlobalMatchState): GlobalMatchState {
  return {
    players: Object.values(state.players).reduce<Record<string, MatchPlayerState>>((acc, player) => {
      acc[player.sessionId] = clonePlayer(player);
      return acc;
    }, {})
  };
}

function normalizeMovePayload(payload: MatchMovePayload | undefined): {
  x: number;
  y: number;
  z: number;
  rotationY: number;
} | null {
  const x = normalizePositionValue(payload?.x);
  const y = normalizePositionValue(payload?.y);
  const z = normalizePositionValue(payload?.z);
  const rotationY = normalizeRotationValue(payload?.rotationY);

  if (x === null || y === null || z === null || rotationY === null) {
    return null;
  }

  return { x, y, z, rotationY };
}

function normalizeSprintInputPayload(
  payload: MatchSprintIntentPayload | undefined
): SprintInputState | null {
  const isShiftPressed = normalizeBooleanValue(payload?.isShiftPressed);
  const isForwardPressed = normalizeBooleanValue(payload?.isForwardPressed);

  if (isShiftPressed === null || isForwardPressed === null) {
    return null;
  }

  return {
    isShiftPressed,
    isForwardPressed
  };
}

function resolveHorizontalPlayerCollision(options: {
  sessionId: string;
  desiredX: number;
  desiredY: number;
  desiredZ: number;
  rotationY: number;
  players: Record<string, MatchPlayerState>;
}): { x: number; z: number } {
  let resolvedX = options.desiredX;
  let resolvedZ = options.desiredZ;

  const fallbackDirectionX = Math.sin(options.rotationY);
  const fallbackDirectionZ = Math.cos(options.rotationY);
  const fallbackLength = Math.hypot(fallbackDirectionX, fallbackDirectionZ);
  const safeFallbackX = fallbackLength > PLAYER_COLLISION_EPSILON ? fallbackDirectionX / fallbackLength : 1;
  const safeFallbackZ = fallbackLength > PLAYER_COLLISION_EPSILON ? fallbackDirectionZ / fallbackLength : 0;

  for (let pass = 0; pass < PLAYER_COLLISION_RESOLVE_PASSES; pass += 1) {
    let hadOverlap = false;

    for (const otherPlayer of Object.values(options.players)) {
      if (otherPlayer.sessionId === options.sessionId) {
        continue;
      }

      const verticalDistance = Math.abs(options.desiredY - otherPlayer.y);
      if (verticalDistance > PLAYER_COLLISION_HEIGHT) {
        continue;
      }

      const deltaX = resolvedX - otherPlayer.x;
      const deltaZ = resolvedZ - otherPlayer.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared >= PLAYER_COLLISION_MIN_DISTANCE_SQUARED) {
        continue;
      }

      const safeDistance = Math.sqrt(Math.max(distanceSquared, PLAYER_COLLISION_EPSILON));
      const normalX = safeDistance > PLAYER_COLLISION_EPSILON ? deltaX / safeDistance : safeFallbackX;
      const normalZ = safeDistance > PLAYER_COLLISION_EPSILON ? deltaZ / safeDistance : safeFallbackZ;
      const penetrationDepth = PLAYER_COLLISION_MIN_DISTANCE - safeDistance;
      if (penetrationDepth <= 0) {
        continue;
      }

      resolvedX += normalX * (penetrationDepth + 0.0001);
      resolvedZ += normalZ * (penetrationDepth + 0.0001);
      hadOverlap = true;
    }

    if (!hadOverlap) {
      break;
    }
  }

  return { x: resolvedX, z: resolvedZ };
}

function snapshotCombatState(player: MatchPlayerState): PlayerCombatSnapshot {
  return {
    isAttacking: player.isAttacking,
    attackComboIndex: player.attackComboIndex,
    lastAttackAt: player.lastAttackAt,
    isBlocking: player.isBlocking,
    blockStartedAt: player.blockStartedAt,
    currentGuard: player.currentGuard,
    isGuardBroken: player.isGuardBroken,
    stunUntil: player.stunUntil,
    lastGuardDamagedAt: player.lastGuardDamagedAt,
    x: player.x,
    y: player.y,
    z: player.z
  };
}

function didCombatStateChange(previous: PlayerCombatSnapshot, current: MatchPlayerState): boolean {
  return (
    previous.isAttacking !== current.isAttacking ||
    previous.attackComboIndex !== current.attackComboIndex ||
    previous.lastAttackAt !== current.lastAttackAt ||
    previous.isBlocking !== current.isBlocking ||
    previous.blockStartedAt !== current.blockStartedAt ||
    previous.currentGuard !== current.currentGuard ||
    previous.isGuardBroken !== current.isGuardBroken ||
    previous.stunUntil !== current.stunUntil ||
    previous.lastGuardDamagedAt !== current.lastGuardDamagedAt ||
    previous.x !== current.x ||
    previous.y !== current.y ||
    previous.z !== current.z
  );
}

export class GlobalMatchRoom extends Room {
  private readonly spawnService = new SpawnService();
  private readonly sprintInputsBySessionId = new Map<string, SprintInputState>();
  private readonly movementStateBySessionId = new Map<string, PlayerMovementState>();
  private lastSprintTickAt = Date.now();
  private stateDirty = false;

  private get matchState(): GlobalMatchState {
    return this.state as GlobalMatchState;
  }

  private broadcastCombatState(player: MatchPlayerState): void {
    this.broadcast(MATCH_COMBAT_STATE_EVENT, {
      sessionId: player.sessionId,
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
      x: player.x,
      y: player.y,
      z: player.z
    });
  }

  private async syncLobbyMetadata(): Promise<void> {
    const players = Object.values(this.matchState.players);
    const sortedNicknames = players
      .map((player) => player.nickname)
      .sort((left, right) => left.localeCompare(right));

    try {
      await this.setMetadata({
        onlinePlayers: players.length,
        playerNicknames: sortedNicknames,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.warn("[global_match] Failed to update lobby metadata.", error);
    }
  }

  onCreate(): void {
    this.autoDispose = false;
    this.setState({ players: {} });
    this.stateDirty = true;
    this.lastSprintTickAt = Date.now();
    void this.syncLobbyMetadata();

    this.onMessage(MATCH_SNAPSHOT_REQUEST_EVENT, (client) => {
      client.send(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
    });

    this.onMessage(MATCH_PLAYER_MOVE_EVENT, (client, payload: MatchMovePayload) => {
      this.handlePlayerMove(client, payload);
    });

    this.onMessage(MATCH_PLAYER_SPRINT_INTENT_EVENT, (client, payload: MatchSprintIntentPayload) => {
      this.handleSprintIntent(client, payload);
    });

    this.onMessage(MATCH_ULTIMATE_ACTIVATE_EVENT, (client, _payload: MatchUltimateActivatePayload) => {
      this.handleUltimateActivate(client);
    });

    this.onMessage(MATCH_ATTACK_START_EVENT, (client, _payload: MatchAttackStartPayload) => {
      this.handleAttackStart(client);
    });

    this.onMessage(MATCH_BLOCK_START_EVENT, (client, _payload: MatchBlockStartPayload) => {
      this.handleBlockStart(client);
    });

    this.onMessage(MATCH_BLOCK_END_EVENT, (client, _payload: MatchBlockEndPayload) => {
      this.handleBlockEnd(client);
    });

    this.onMessage(MATCH_PLAYER_RESPAWN_EVENT, (client, _payload: MatchRespawnRequestPayload) => {
      this.handleRespawnRequest(client);
    });

    this.clock.setInterval(() => {
      if (!this.stateDirty) {
        return;
      }

      this.broadcast(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
      this.stateDirty = false;
    }, MATCH_STATE_SYNC_INTERVAL_MS);

    this.clock.setInterval(() => {
      this.tickSprintAndCombat();
    }, MATCH_SPRINT_TICK_INTERVAL_MS);

    this.clock.setInterval(() => {
      this.tickUltimateChargeForTesting();
    }, MATCH_ULTIMATE_AUTO_CHARGE_INTERVAL_MS);
  }

  async onJoin(client: Client, options?: MatchJoinOptions): Promise<void> {
    const userId = normalizeText(options?.userId);
    const nickname = normalizeNickname(options?.nickname);

    if (!userId || !nickname) {
      throw new Error("Invalid join payload. 'userId' and 'nickname' are required.");
    }

    const now = Date.now();
    const heroId = normalizeHeroId(options?.heroId);
    const heroCombatConfig = resolveHeroCombatServerConfig(heroId);
    const spawn = this.spawnService.getNextSpawnPoint();
    const resolvedSpawn = resolveHorizontalPlayerCollision({
      sessionId: client.sessionId,
      desiredX: spawn.x,
      desiredY: spawn.y,
      desiredZ: spawn.z,
      rotationY: 0,
      players: this.matchState.players
    });

    const player: MatchPlayerState = {
      sessionId: client.sessionId,
      userId,
      nickname,
      heroId,
      x: resolvedSpawn.x,
      y: spawn.y,
      z: resolvedSpawn.z,
      rotationY: 0,
      maxHealth: 0,
      currentHealth: 0,
      isAlive: true,
      ultimateCharge: 0,
      ultimateMax: 0,
      isUltimateReady: false,
      maxStamina: 0,
      currentStamina: 0,
      isSprinting: false,
      sprintBlocked: false,
      lastSprintEndedAt: now,
      isAttacking: false,
      attackComboIndex: 0,
      lastAttackAt: 0,
      isBlocking: false,
      blockStartedAt: 0,
      maxGuard: 0,
      currentGuard: 0,
      isGuardBroken: false,
      stunUntil: 0,
      lastGuardDamagedAt: now,
      joinedAt: now
    };

    resetHealth(player, heroCombatConfig.maxHealth);
    resetUltimate(player, heroCombatConfig.ultimateMax);
    initializeStamina(player, now);
    initializeGuardState(player, now);

    this.matchState.players[client.sessionId] = player;
    this.sprintInputsBySessionId.set(client.sessionId, {
      isShiftPressed: false,
      isForwardPressed: false
    });
    this.movementStateBySessionId.set(client.sessionId, initializePlayerMovementState(now));
    this.stateDirty = true;
    await this.syncLobbyMetadata();

    client.send(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
    this.broadcast(
      MATCH_PLAYER_JOINED_EVENT,
      {
        player: clonePlayer(player)
      },
      { except: client }
    );
    this.broadcast(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState), { except: client });
  }

  async onLeave(client: Client): Promise<void> {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    delete this.matchState.players[client.sessionId];
    this.sprintInputsBySessionId.delete(client.sessionId);
    this.movementStateBySessionId.delete(client.sessionId);
    this.stateDirty = true;
    await this.syncLobbyMetadata();

    this.broadcast(MATCH_PLAYER_LEFT_EVENT, {
      sessionId: client.sessionId,
      userId: player.userId,
      leftAt: Date.now()
    });
    this.broadcast(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
  }

  private handleAttackStart(client: Client): void {
    const attacker = this.matchState.players[client.sessionId];
    if (!attacker) {
      return;
    }

    const result = handleAttackStart({
      attacker,
      players: this.matchState.players,
      now: Date.now()
    });

    if (!result.stateChanged) {
      return;
    }

    this.stateDirty = true;
    this.broadcastCombatState(attacker);

    if (result.hitEvent) {
      this.broadcast(MATCH_COMBAT_HIT_EVENT, result.hitEvent);
      const target = this.matchState.players[result.hitEvent.targetSessionId];
      if (target) {
        this.broadcastCombatState(target);
      }
    }

    if (result.blockEvent) {
      this.broadcast(MATCH_COMBAT_BLOCK_EVENT, result.blockEvent);
    }

    if (result.guardBreakEvent) {
      this.broadcast(MATCH_COMBAT_GUARD_BREAK_EVENT, result.guardBreakEvent);
    }
  }

  private handleBlockStart(client: Client): void {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    const didStart = handleBlockStart(player, Date.now());
    if (!didStart) {
      return;
    }

    this.stateDirty = true;
    this.broadcastCombatState(player);
  }

  private handleBlockEnd(client: Client): void {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    const didEnd = handleBlockEnd(player);
    if (!didEnd) {
      return;
    }

    this.stateDirty = true;
    this.broadcastCombatState(player);
  }

  private handleUltimateActivate(client: Client): void {
    const player = this.matchState.players[client.sessionId];
    if (!player || !player.isAlive) {
      return;
    }

    syncUltimateReady(player);
    if (!player.isUltimateReady || player.ultimateCharge < player.ultimateMax) {
      return;
    }

    const wasConsumed = consumeUltimate(player);
    if (!wasConsumed) {
      return;
    }

    this.stateDirty = true;
  }

  private handleRespawnRequest(client: Client): void {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    if (player.isAlive) {
      return;
    }

    const now = Date.now();
    const heroCombatConfig = resolveHeroCombatServerConfig(player.heroId);
    const spawn = this.spawnService.getNextSpawnPoint();
    const resolvedSpawn = resolveHorizontalPlayerCollision({
      sessionId: player.sessionId,
      desiredX: spawn.x,
      desiredY: spawn.y,
      desiredZ: spawn.z,
      rotationY: 0,
      players: this.matchState.players
    });

    resetHealth(player, heroCombatConfig.maxHealth);
    resetUltimate(player, heroCombatConfig.ultimateMax);
    initializeStamina(player, now);
    initializeGuardState(player, now);
    player.isAttacking = false;
    player.attackComboIndex = 0;
    player.lastAttackAt = 0;
    player.isBlocking = false;
    player.blockStartedAt = 0;
    player.isSprinting = false;
    player.stunUntil = 0;
    player.x = resolvedSpawn.x;
    player.y = spawn.y;
    player.z = resolvedSpawn.z;
    player.rotationY = 0;

    this.stateDirty = true;
    this.broadcastCombatState(player);
    this.broadcast(MATCH_PLAYER_MOVED_EVENT, {
      sessionId: player.sessionId,
      x: player.x,
      y: player.y,
      z: player.z,
      rotationY: player.rotationY
    });
  }

  private tickUltimateChargeForTesting(): void {
    let didUpdateAnyPlayer = false;

    Object.values(this.matchState.players).forEach((player) => {
      if (!player.isAlive) {
        return;
      }

      const previousUltimateCharge = player.ultimateCharge;
      const previousUltimateReady = player.isUltimateReady;
      addUltimateCharge(player, MATCH_ULTIMATE_AUTO_CHARGE_AMOUNT);

      if (
        player.ultimateCharge !== previousUltimateCharge ||
        player.isUltimateReady !== previousUltimateReady
      ) {
        didUpdateAnyPlayer = true;
      }
    });

    if (didUpdateAnyPlayer) {
      this.stateDirty = true;
    }
  }

  private handleSprintIntent(client: Client, payload: MatchSprintIntentPayload): void {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    const normalizedInput = normalizeSprintInputPayload(payload);
    if (!normalizedInput) {
      return;
    }

    this.sprintInputsBySessionId.set(client.sessionId, normalizedInput);
  }

  private tickSprintAndCombat(): void {
    const now = Date.now();
    const deltaTime = Math.min(
      MATCH_MAX_SPRINT_DELTA_SECONDS,
      Math.max(0, (now - this.lastSprintTickAt) / 1000)
    );
    this.lastSprintTickAt = now;

    let didChangeSprintOrStamina = false;

    Object.values(this.matchState.players).forEach((player) => {
      const sprintInput = this.sprintInputsBySessionId.get(player.sessionId) ?? {
        isShiftPressed: false,
        isForwardPressed: false
      };
      const previousCurrentStamina = player.currentStamina;
      const previousIsSprinting = player.isSprinting;
      const previousSprintBlocked = player.sprintBlocked;
      const previousLastSprintEndedAt = player.lastSprintEndedAt;

      updateSprintState(player, sprintInput, deltaTime, now);

      if (
        player.currentStamina !== previousCurrentStamina ||
        player.isSprinting !== previousIsSprinting ||
        player.sprintBlocked !== previousSprintBlocked ||
        player.lastSprintEndedAt !== previousLastSprintEndedAt
      ) {
        didChangeSprintOrStamina = true;
      }
    });

    const combatSnapshots = new Map<string, PlayerCombatSnapshot>();
    Object.values(this.matchState.players).forEach((player) => {
      combatSnapshots.set(player.sessionId, snapshotCombatState(player));
    });

    const didChangeCombat = tickCombatState(this.matchState.players, deltaTime, now);

    if (didChangeCombat) {
      Object.values(this.matchState.players).forEach((player) => {
        const previous = combatSnapshots.get(player.sessionId);
        if (!previous) {
          return;
        }

        if (!didCombatStateChange(previous, player)) {
          return;
        }

        this.broadcastCombatState(player);
      });
    }

    if (didChangeSprintOrStamina || didChangeCombat) {
      this.stateDirty = true;
    }
  }

  private handlePlayerMove(client: Client, payload: MatchMovePayload): void {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    const normalizedMove = normalizeMovePayload(payload);
    if (!normalizedMove) {
      return;
    }

    const movementState =
      this.movementStateBySessionId.get(client.sessionId) ?? initializePlayerMovementState(Date.now());
    this.movementStateBySessionId.set(client.sessionId, movementState);

    const validatedMove = applyAuthoritativeMovementValidation({
      player,
      desiredX: normalizedMove.x,
      desiredY: normalizedMove.y,
      desiredZ: normalizedMove.z,
      rotationY: normalizedMove.rotationY,
      movementState,
      now: Date.now()
    });

    const resolvedMove = resolveHorizontalPlayerCollision({
      sessionId: player.sessionId,
      desiredX: validatedMove.x,
      desiredY: validatedMove.y,
      desiredZ: validatedMove.z,
      rotationY: validatedMove.rotationY,
      players: this.matchState.players
    });

    player.x = resolvedMove.x;
    player.y = validatedMove.y;
    player.z = resolvedMove.z;
    player.rotationY = validatedMove.rotationY;
    this.stateDirty = true;

    this.broadcast(MATCH_PLAYER_MOVED_EVENT, {
      sessionId: player.sessionId,
      x: player.x,
      y: player.y,
      z: player.z,
      rotationY: player.rotationY
    });
  }
}
