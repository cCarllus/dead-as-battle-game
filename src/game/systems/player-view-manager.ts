// Responsável por manter PlayerViews em Map<sessionId, PlayerView> e aplicar sync de rede apenas no gameplayRoot.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { LocalPlayerView } from "../entities/local-player.view";
import type { PlayerViewRole, RemotePlayerView } from "../entities/remote-player.view";
import { createPlayerFactory } from "./player-factory";

const LOCAL_SERVER_RECONCILE_DISTANCE_SQUARED = 0.0025;
const LOCAL_SERVER_RECONCILE_ROTATION_DELTA = 0.08;
const ENABLE_MATCH_VIEW_DEBUG_LOGS = false;

function logMatchView(event: string, payload: Record<string, unknown>): void {
  if (!ENABLE_MATCH_VIEW_DEBUG_LOGS) {
    return;
  }

  console.debug(event, payload);
}

function resolveRole(
  player: MatchPlayerState,
  localSessionId: string,
  localUserId: string | null,
  teamMemberUserIds: ReadonlySet<string>
): PlayerViewRole {
  if (player.sessionId === localSessionId) {
    return "local";
  }

  if (localUserId && teamMemberUserIds.has(player.userId)) {
    return "teammate";
  }

  return "enemy";
}

function clonePlayerState(player: MatchPlayerState): MatchPlayerState {
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
    maxStamina: player.maxStamina,
    currentStamina: player.currentStamina,
    isSprinting: player.isSprinting,
    sprintBlocked: player.sprintBlocked,
    lastSprintEndedAt: player.lastSprintEndedAt,
    joinedAt: player.joinedAt
  };
}

function didPlayerStateChange(previous: MatchPlayerState | undefined, next: MatchPlayerState): boolean {
  if (!previous) {
    return true;
  }

  return (
    previous.x !== next.x ||
    previous.y !== next.y ||
    previous.z !== next.z ||
    previous.rotationY !== next.rotationY ||
    previous.isSprinting !== next.isSprinting ||
    previous.isAlive !== next.isAlive ||
    previous.nickname !== next.nickname ||
    previous.heroId !== next.heroId ||
    previous.joinedAt !== next.joinedAt ||
    previous.userId !== next.userId
  );
}

function squaredDistance(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

export type PlayerViewManager = {
  syncPlayers: (players: MatchPlayerState[]) => void;
  addPlayer: (player: MatchPlayerState) => void;
  updatePlayer: (player: MatchPlayerState) => void;
  removePlayer: (sessionId: string) => void;
  setTeamMemberUserIds: (userIds: string[]) => void;
  updateLocalPlayerTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
  tick: (nowMs: number) => void;
  getLocalPlayerView: () => LocalPlayerView | null;
  getLocalPlayerState: () => MatchPlayerState | null;
  dispose: () => void;
};

export type CreatePlayerViewManagerOptions = {
  scene: Scene;
  localSessionId: string;
};

export function createPlayerViewManager(options: CreatePlayerViewManagerOptions): PlayerViewManager {
  const playersBySessionId = new Map<string, MatchPlayerState>();
  const playerViewsBySessionId = new Map<string, RemotePlayerView>();
  const rolesBySessionId = new Map<string, PlayerViewRole>();
  const playerFactory = createPlayerFactory(options.scene);

  let teamMemberUserIds = new Set<string>();

  const getLocalPlayerState = (): MatchPlayerState | null => {
    return playersBySessionId.get(options.localSessionId) ?? null;
  };

  const getLocalPlayerView = (): LocalPlayerView | null => {
    const localView = playerViewsBySessionId.get(options.localSessionId);
    return (localView as LocalPlayerView | undefined) ?? null;
  };

  const removePlayerView = (sessionId: string): void => {
    const view = playerViewsBySessionId.get(sessionId);
    const role = rolesBySessionId.get(sessionId);

    view?.dispose();
    playerViewsBySessionId.delete(sessionId);
    rolesBySessionId.delete(sessionId);

    if (!view || !role) {
      return;
    }

    logMatchView("[match][view:remove]", {
      sessionId,
      role,
      gameplayRootId: view.gameplayRoot.uniqueId,
      collisionBodyId: view.collisionBody.uniqueId
    });
  };

  const createPlayerView = (player: MatchPlayerState, localUserId: string | null): void => {
    const role = resolveRole(
      player,
      options.localSessionId,
      localUserId,
      teamMemberUserIds
    );

    removePlayerView(player.sessionId);

    const nextView =
      role === "local"
        ? playerFactory.createLocalPlayerView(player)
        : playerFactory.createRemotePlayerView(player, role);

    playerViewsBySessionId.set(player.sessionId, nextView);
    rolesBySessionId.set(player.sessionId, role);

    logMatchView("[match][view:create]", {
      sessionId: player.sessionId,
      role,
      nickname: player.nickname,
      gameplayRootId: nextView.gameplayRoot.uniqueId,
      collisionBodyId: nextView.collisionBody.uniqueId,
      x: player.x,
      y: player.y,
      z: player.z
    });
  };

  const syncPlayerViewFromServer = (player: MatchPlayerState, localUserId: string | null): void => {
    const view = playerViewsBySessionId.get(player.sessionId);
    const nextRole = resolveRole(
      player,
      options.localSessionId,
      localUserId,
      teamMemberUserIds
    );
    const currentRole = rolesBySessionId.get(player.sessionId);

    if (!view || !currentRole || currentRole !== nextRole) {
      createPlayerView(player, localUserId);
      return;
    }

    if (player.sessionId === options.localSessionId) {
      const localTransform = view.getTransform();
      const shouldReconcileFromServer =
        squaredDistance(localTransform, player) >= LOCAL_SERVER_RECONCILE_DISTANCE_SQUARED ||
        Math.abs(localTransform.rotationY - player.rotationY) >= LOCAL_SERVER_RECONCILE_ROTATION_DELTA;

      if (!shouldReconcileFromServer) {
        return;
      }
    }

    view.updateFromState(player);

    logMatchView("[match][view:update]", {
      sessionId: player.sessionId,
      role: nextRole,
      gameplayRootId: view.gameplayRoot.uniqueId,
      collisionBodyId: view.collisionBody.uniqueId,
      x: player.x,
      y: player.y,
      z: player.z
    });
  };

  const upsertPlayerState = (player: MatchPlayerState): void => {
    playersBySessionId.set(player.sessionId, clonePlayerState(player));
  };

  const addPlayer = (player: MatchPlayerState): void => {
    upsertPlayerState(player);

    const localUserId = getLocalPlayerState()?.userId ?? null;
    createPlayerView(player, localUserId);

    if (player.sessionId !== options.localSessionId) {
      return;
    }

    Array.from(playersBySessionId.values()).forEach((otherPlayer) => {
      if (otherPlayer.sessionId === options.localSessionId) {
        return;
      }

      syncPlayerViewFromServer(otherPlayer, player.userId);
    });
  };

  const updatePlayer = (player: MatchPlayerState): void => {
    const previous = playersBySessionId.get(player.sessionId);
    upsertPlayerState(player);

    const localUserId = getLocalPlayerState()?.userId ?? null;
    if (!previous) {
      createPlayerView(player, localUserId);
      return;
    }

    const role = resolveRole(
      player,
      options.localSessionId,
      localUserId,
      teamMemberUserIds
    );
    const currentRole = rolesBySessionId.get(player.sessionId);
    const shouldSync =
      didPlayerStateChange(previous, player) ||
      !playerViewsBySessionId.has(player.sessionId) ||
      currentRole !== role;

    if (!shouldSync) {
      return;
    }

    syncPlayerViewFromServer(player, localUserId);

    if (
      player.sessionId === options.localSessionId &&
      previous.userId !== player.userId
    ) {
      Array.from(playersBySessionId.values()).forEach((otherPlayer) => {
        if (otherPlayer.sessionId === options.localSessionId) {
          return;
        }

        syncPlayerViewFromServer(otherPlayer, player.userId);
      });
    }
  };

  const removePlayer = (sessionId: string): void => {
    playersBySessionId.delete(sessionId);
    removePlayerView(sessionId);
  };

  const syncPlayers = (players: MatchPlayerState[]): void => {
    const activeSessionIds = new Set(players.map((player) => player.sessionId));
    const previousStates = new Map(playersBySessionId);

    Array.from(playersBySessionId.keys()).forEach((sessionId) => {
      if (!activeSessionIds.has(sessionId)) {
        removePlayer(sessionId);
      }
    });

    players.forEach((player) => {
      upsertPlayerState(player);
    });

    const localUserId = getLocalPlayerState()?.userId ?? null;

    players.forEach((player) => {
      const previous = previousStates.get(player.sessionId);
      const hasView = playerViewsBySessionId.has(player.sessionId);
      const role = resolveRole(
        player,
        options.localSessionId,
        localUserId,
        teamMemberUserIds
      );
      const roleChanged = rolesBySessionId.get(player.sessionId) !== role;

      if (!previous || !hasView || roleChanged) {
        createPlayerView(player, localUserId);
        return;
      }

      if (didPlayerStateChange(previous, player)) {
        syncPlayerViewFromServer(player, localUserId);
      }
    });
  };

  return {
    syncPlayers,
    addPlayer,
    updatePlayer,
    removePlayer,
    setTeamMemberUserIds: (userIds) => {
      teamMemberUserIds = new Set(userIds);

      const localUserId = getLocalPlayerState()?.userId ?? null;
      Array.from(playersBySessionId.values()).forEach((player) => {
        syncPlayerViewFromServer(player, localUserId);
      });
    },
    updateLocalPlayerTransform: (transform) => {
      const localPlayer = playersBySessionId.get(options.localSessionId);
      const localPlayerView = getLocalPlayerView();
      if (!localPlayer || !localPlayerView) {
        return;
      }

      localPlayerView.updateFromState({
        ...localPlayer,
        x: transform.x,
        y: transform.y,
        z: transform.z,
        rotationY: transform.rotationY
      });

      playersBySessionId.set(options.localSessionId, {
        ...localPlayer,
        x: transform.x,
        y: transform.y,
        z: transform.z,
        rotationY: transform.rotationY
      });
    },
    tick: (nowMs) => {
      playerViewsBySessionId.forEach((view) => {
        view.tick(nowMs);
      });
    },
    getLocalPlayerView,
    getLocalPlayerState,
    dispose: () => {
      playerViewsBySessionId.forEach((view) => {
        view.dispose();
      });

      playerViewsBySessionId.clear();
      playersBySessionId.clear();
      rolesBySessionId.clear();
    }
  };
}
