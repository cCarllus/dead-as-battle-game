// Room enxuta: conecta jogadores, registra handlers, executa loop fixo e replica estado autoritativo.
import { Client, Room } from "@colyseus/core";
import { resolveHeroCombatServerConfig, VALID_HERO_IDS } from "../config/hero-combat.config.js";
import { resolveCombatKitDefinition } from "../combat/combat-definition.js";
import { buildCombatStatePayloadForPlayer } from "../combat/combat-controller.js";
import { cloneMatchState, clonePlayerState } from "../models/match-state.model.js";
import type {
  GlobalMatchState,
  MatchJoinOptions,
  MatchPlayerState,
  MatchPlayerRespawnedEventPayload
} from "../models/match-player.model.js";
import { createAbilityHandler } from "../network/ability.handler.js";
import { createCombatHandler } from "../network/combat.handler.js";
import { MATCH_EVENTS } from "../network/match-events.js";
import { createPlayerInputHandler } from "../network/player-input.handler.js";
import { initializeGuardState } from "../services/block-guard.service.js";
import { resetHealth } from "../services/health.service.js";
import { initializePlayerMovementState, type PlayerMovementState } from "../services/movement-state.service.js";
import { normalizeMoveIntent, resolveHorizontalPlayerCollision, type NormalizedMoveIntent } from "../services/movement.service.js";
import { respawnPlayer } from "../services/respawn.service.js";
import { SpawnService } from "../services/spawn.service.js";
import { initializeStamina, type SprintInputState } from "../services/stamina.service.js";
import { resetUltimate } from "../services/ultimate.service.js";
import { createCombatSystem, type CombatSystem } from "../systems/combat.system.js";
import { createMovementSystem, type MovementSystem } from "../systems/movement.system.js";
import { createRegenerationSystem, type RegenerationSystem } from "../systems/regeneration.system.js";

const DEFAULT_HERO_ID = "default_champion";
const MAX_NICKNAME_LENGTH = 24;
const SIMULATION_TICK_MS = 50;
const SNAPSHOT_SYNC_INTERVAL_MS = 120;
const MAX_TICK_DELTA_SECONDS = 0.2;

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

function normalizeHeroLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

export class GlobalMatchRoom extends Room {
  private readonly spawnService = new SpawnService();
  private readonly moveIntentBySessionId = new Map<string, NormalizedMoveIntent>();
  private readonly sprintInputBySessionId = new Map<string, SprintInputState>();
  private readonly movementStateBySessionId = new Map<string, PlayerMovementState>();
  private readonly queuedRespawnRequests = new Set<string>();

  private movementSystem: MovementSystem | null = null;
  private combatSystem: CombatSystem | null = null;
  private regenerationSystem: RegenerationSystem | null = null;

  private stateDirty = false;

  private get matchState(): GlobalMatchState {
    return this.state as GlobalMatchState;
  }

  private markStateDirty(): void {
    this.stateDirty = true;
  }

  private broadcastCombatState(player: MatchPlayerState): void {
    this.broadcast(MATCH_EVENTS.combatState, buildCombatStatePayloadForPlayer(player));
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

  private processRespawnRequests(now: number): MatchPlayerState[] {
    const respawnedPlayers: MatchPlayerState[] = [];
    Array.from(this.queuedRespawnRequests.values()).forEach((sessionId) => {
      const player = this.matchState.players[sessionId];
      if (!player) {
        return;
      }

      const result = respawnPlayer({
        player,
        players: this.matchState.players,
        spawnService: this.spawnService,
        sprintInputsBySessionId: this.sprintInputBySessionId,
        movementStateBySessionId: this.movementStateBySessionId,
        now
      });

      if (!result.didRespawn) {
        return;
      }

      respawnedPlayers.push(result.player);
      console.info(
        `[RESPAWN] ${result.player.nickname} respawned at X:${result.player.x.toFixed(2)} Y:${result.player.y.toFixed(
          2
        )} Z:${result.player.z.toFixed(2)}`
      );
    });
    this.queuedRespawnRequests.clear();
    return respawnedPlayers;
  }

  private runSimulationTick(deltaMilliseconds: number): void {
    const movementSystem = this.movementSystem;
    const combatSystem = this.combatSystem;
    const regenerationSystem = this.regenerationSystem;
    if (!movementSystem || !combatSystem || !regenerationSystem) {
      return;
    }

    const now = Date.now();
    const deltaSeconds = Math.min(
      MAX_TICK_DELTA_SECONDS,
      Math.max(0, Number.isFinite(deltaMilliseconds) ? deltaMilliseconds / 1000 : 0)
    );

    const movementResult = movementSystem.update(deltaSeconds, now);
    movementResult.movedPlayers.forEach((moved) => {
      this.broadcast(MATCH_EVENTS.playerMoved, moved);
    });

    const combatResult = combatSystem.update(deltaSeconds, now);
    combatResult.attackStartedEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.attackStart, eventPayload);
    });
    combatResult.blockStartedEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.blockStart, eventPayload);
    });
    combatResult.blockEndedEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.blockEnd, eventPayload);
    });
    combatResult.hitEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatHit, eventPayload);
    });
    combatResult.blockEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatBlock, eventPayload);
    });
    combatResult.guardBreakEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatGuardBreak, eventPayload);
    });
    combatResult.killEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatKill, eventPayload);
    });
    combatResult.skillCastStartedEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatSkillCastStarted, eventPayload);
    });
    combatResult.skillCastFinishedEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatSkillCastFinished, eventPayload);
    });
    combatResult.deathEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatPlayerDied, eventPayload);
    });
    combatResult.ragdollEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatRagdollEnabled, eventPayload);
    });
    combatResult.ultimateEvents.forEach((eventPayload) => {
      this.broadcast(MATCH_EVENTS.combatUltimate, eventPayload);
    });

    const regenerationResult = regenerationSystem.update(now);
    const respawnedPlayers = this.processRespawnRequests(now);

    const combatStatePlayersBySessionId = new Map<string, MatchPlayerState>();
    combatResult.combatStateChangedPlayers.forEach((player) => {
      combatStatePlayersBySessionId.set(player.sessionId, player);
    });
    respawnedPlayers.forEach((player) => {
      combatStatePlayersBySessionId.set(player.sessionId, player);
      this.broadcast(MATCH_EVENTS.playerRespawn, {
        player: clonePlayerState(player),
        respawnedAt: now
      } satisfies MatchPlayerRespawnedEventPayload);
      this.broadcast(MATCH_EVENTS.playerMoved, {
        sessionId: player.sessionId,
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        locomotionState: player.locomotionState,
        isCrouching: player.isCrouching,
        isRolling: player.isRolling,
        isWallRunning: player.isWallRunning,
        wallRunSide: player.wallRunSide,
        verticalVelocity: player.verticalVelocity
      });
    });
    combatStatePlayersBySessionId.forEach((player) => {
      this.broadcastCombatState(player);
    });

    if (
      movementResult.didChangeState ||
      combatResult.didChangeState ||
      regenerationResult.didChangeState ||
      respawnedPlayers.length > 0
    ) {
      this.markStateDirty();
    }
  }

  onCreate(): void {
    this.autoDispose = false;
    this.setState({ players: {} });
    this.markStateDirty();
    void this.syncLobbyMetadata();

    this.movementSystem = createMovementSystem({
      players: () => this.matchState.players,
      moveIntentBySessionId: this.moveIntentBySessionId,
      sprintInputBySessionId: this.sprintInputBySessionId,
      movementStateBySessionId: this.movementStateBySessionId
    });
    this.combatSystem = createCombatSystem({
      players: () => this.matchState.players
    });
    this.regenerationSystem = createRegenerationSystem({
      players: () => this.matchState.players
    });

    createPlayerInputHandler({
      moveIntentBySessionId: this.moveIntentBySessionId,
      sprintInputBySessionId: this.sprintInputBySessionId,
      queuedRespawnRequests: this.queuedRespawnRequests,
      onSnapshotRequest: (client) => {
        client.send(MATCH_EVENTS.snapshot, cloneMatchState(this.matchState));
      }
    }).bind(this);
    createCombatHandler({
      queueAttackStart: (sessionId) => this.combatSystem?.queueAttackStart(sessionId),
      queueSkillCast: (sessionId, slot) => this.combatSystem?.queueSkillCast(sessionId, slot),
      queueBlockStart: (sessionId) => this.combatSystem?.queueBlockStart(sessionId),
      queueBlockEnd: (sessionId) => this.combatSystem?.queueBlockEnd(sessionId)
    }).bind(this);
    createAbilityHandler({
      queueSkillCast: (sessionId, slot) => this.combatSystem?.queueSkillCast(sessionId, slot)
    }).bind(this);

    this.setSimulationInterval((deltaMilliseconds) => {
      this.runSimulationTick(deltaMilliseconds);
    }, SIMULATION_TICK_MS);

    this.clock.setInterval(() => {
      if (!this.stateDirty) {
        return;
      }

      this.broadcast(MATCH_EVENTS.snapshot, cloneMatchState(this.matchState));
      this.stateDirty = false;
    }, SNAPSHOT_SYNC_INTERVAL_MS);
  }

  async onJoin(client: Client, options?: MatchJoinOptions): Promise<void> {
    const userId = normalizeText(options?.userId);
    const nickname = normalizeNickname(options?.nickname);
    if (!userId || !nickname) {
      throw new Error("Invalid join payload. 'userId' and 'nickname' are required.");
    }

    const now = Date.now();
    const heroId = normalizeHeroId(options?.heroId);
    const heroLevel = normalizeHeroLevel(options?.heroLevel);
    const heroCombatConfig = resolveHeroCombatServerConfig(heroId);
    const combatKit = resolveCombatKitDefinition(heroId);
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
      heroLevel,
      kills: 0,
      deaths: 0,
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
      isUsingUltimate: false,
      ultimateStartedAt: 0,
      ultimateEndsAt: 0,
      maxStamina: 0,
      currentStamina: 0,
      isSprinting: false,
      locomotionState: "Idle",
      isCrouching: false,
      isRolling: false,
      isWallRunning: false,
      wallRunSide: "none",
      verticalVelocity: 0,
      sprintBlocked: false,
      lastSprintEndedAt: now,
      isAttacking: false,
      attackComboIndex: 0,
      lastAttackAt: 0,
      combatState: "CombatIdle",
      combatStateStartedAt: now,
      combatStateEndsAt: 0,
      attackPhase: "None",
      activeActionId: "",
      activeSkillId: "",
      queuedAttack: false,
      lastDamagedAt: 0,
      deadAt: 0,
      respawnAvailableAt: now + combatKit.respawnDelayMs,
      skillCooldowns: {},
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
    this.sprintInputBySessionId.set(client.sessionId, {
      isShiftPressed: false,
      isForwardPressed: false
    });
    this.movementStateBySessionId.set(client.sessionId, initializePlayerMovementState(now));
    this.moveIntentBySessionId.set(
      client.sessionId,
      normalizeMoveIntent({
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        locomotionState: player.locomotionState,
        isCrouching: player.isCrouching,
        isRolling: player.isRolling,
        isWallRunning: player.isWallRunning,
        wallRunSide: player.wallRunSide,
        verticalVelocity: player.verticalVelocity
      }) ?? {
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        locomotionState: player.locomotionState,
        isCrouching: player.isCrouching,
        isRolling: player.isRolling,
        isWallRunning: player.isWallRunning,
        wallRunSide: player.wallRunSide,
        verticalVelocity: player.verticalVelocity
      }
    );

    this.markStateDirty();
    await this.syncLobbyMetadata();

    client.send(MATCH_EVENTS.snapshot, cloneMatchState(this.matchState));
    this.broadcast(
      MATCH_EVENTS.playerJoined,
      {
        player: clonePlayerState(player)
      },
      { except: client }
    );
    this.broadcast(MATCH_EVENTS.snapshot, cloneMatchState(this.matchState), { except: client });
  }

  async onLeave(client: Client): Promise<void> {
    const player = this.matchState.players[client.sessionId];
    if (!player) {
      return;
    }

    delete this.matchState.players[client.sessionId];
    this.moveIntentBySessionId.delete(client.sessionId);
    this.sprintInputBySessionId.delete(client.sessionId);
    this.movementStateBySessionId.delete(client.sessionId);
    this.queuedRespawnRequests.delete(client.sessionId);
    this.combatSystem?.clearPlayer(client.sessionId);
    this.movementSystem?.clearPlayer(client.sessionId);

    this.markStateDirty();
    await this.syncLobbyMetadata();

    this.broadcast(MATCH_EVENTS.playerLeft, {
      sessionId: client.sessionId,
      userId: player.userId,
      leftAt: Date.now()
    });
    this.broadcast(MATCH_EVENTS.snapshot, cloneMatchState(this.matchState));
  }
}
