// Serviço de respawn autoritativo para manter regra de vida/morte fora da Room.
import { resolveHeroCombatServerConfig } from "../config/hero-combat.config.js";
import type { MatchPlayerState } from "../models/match-player.model.js";
import { initializeGuardState } from "./block-guard.service.js";
import { resetHealth } from "./health.service.js";
import { resolveHorizontalPlayerCollision } from "./movement.service.js";
import { SpawnService } from "./spawn.service.js";
import { initializeStamina } from "./stamina.service.js";
import { resetUltimate } from "./ultimate.service.js";
import { initializePlayerMovementState, type PlayerMovementState } from "./movement-state.service.js";

export type RespawnResult = {
  didRespawn: boolean;
  player: MatchPlayerState;
};

export function respawnPlayer(options: {
  player: MatchPlayerState;
  players: Record<string, MatchPlayerState>;
  spawnService: SpawnService;
  sprintInputsBySessionId: Map<string, { isShiftPressed: boolean; isForwardPressed: boolean }>;
  movementStateBySessionId: Map<string, PlayerMovementState>;
  now: number;
}): RespawnResult {
  const { player } = options;
  if (player.isAlive) {
    return {
      didRespawn: false,
      player
    };
  }

  const heroCombatConfig = resolveHeroCombatServerConfig(player.heroId);
  const spawn = options.spawnService.getNextSpawnPoint();
  const resolvedSpawn = resolveHorizontalPlayerCollision({
    sessionId: player.sessionId,
    desiredX: spawn.x,
    desiredY: spawn.y,
    desiredZ: spawn.z,
    rotationY: 0,
    players: options.players
  });

  resetHealth(player, heroCombatConfig.maxHealth);
  resetUltimate(player, heroCombatConfig.ultimateMax);
  initializeStamina(player, options.now);
  initializeGuardState(player, options.now);

  player.isAttacking = false;
  player.attackComboIndex = 0;
  player.lastAttackAt = 0;
  player.isBlocking = false;
  player.blockStartedAt = 0;
  player.isSprinting = false;
  player.locomotionState = "Idle";
  player.isCrouching = false;
  player.isSliding = false;
  player.isWallRunning = false;
  player.wallRunSide = "none";
  player.verticalVelocity = 0;
  player.stunUntil = 0;
  player.isUsingUltimate = false;
  player.ultimateStartedAt = 0;
  player.ultimateEndsAt = 0;
  player.x = resolvedSpawn.x;
  player.y = spawn.y;
  player.z = resolvedSpawn.z;
  player.rotationY = 0;

  options.sprintInputsBySessionId.set(player.sessionId, {
    isShiftPressed: false,
    isForwardPressed: false
  });
  options.movementStateBySessionId.set(player.sessionId, initializePlayerMovementState(options.now));

  return {
    didRespawn: true,
    player
  };
}
