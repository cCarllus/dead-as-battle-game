// Responsável por criar, atualizar e remover PlayerViews por sessionId com transform autoritativo único.
import type { Scene } from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { LocalPlayerView } from "../entities/local-player.view";
import type { RemotePlayerView } from "../entities/remote-player.view";
import { createPlayerFactory } from "./player-factory";

type RemotePlayerRole = "teammate" | "enemy";

const LOCAL_SERVER_RECONCILE_DISTANCE_SQUARED = 2.25;
const LOCAL_SERVER_RECONCILE_ROTATION_DELTA = 1.1;
const ENABLE_MATCH_VIEW_DEBUG_LOGS = false;

function logMatchView(event: string, payload: Record<string, unknown>): void {
  if (!ENABLE_MATCH_VIEW_DEBUG_LOGS) {
    return;
  }

  console.debug(event, payload);
}

function resolveRole(
  player: MatchPlayerState,
  localUserId: string | null,
  teamMemberUserIds: ReadonlySet<string>
): RemotePlayerRole {
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
  setTeamMemberUserIds: (userIds: string[]) => void;
  updateLocalPlayerTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
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
  const remoteViewsBySessionId = new Map<string, RemotePlayerView>();
  const remoteRoleBySessionId = new Map<string, RemotePlayerRole>();
  const playerFactory = createPlayerFactory(options.scene);

  let teamMemberUserIds = new Set<string>();
  let localPlayerView: LocalPlayerView | null = null;

  const getLocalPlayerState = (): MatchPlayerState | null => playersBySessionId.get(options.localSessionId) ?? null;

  const createLocalView = (player: MatchPlayerState): void => {
    localPlayerView?.dispose();
    localPlayerView = playerFactory.createLocalPlayerView(player);

    logMatchView("[match][view:create]", {
      sessionId: player.sessionId,
      role: "local",
      nickname: player.nickname,
      rootNodeId: localPlayerView.rootNode.uniqueId,
      characterNodeId: localPlayerView.characterMesh.uniqueId,
      x: player.x,
      y: player.y,
      z: player.z
    });
  };

  const syncLocalView = (player: MatchPlayerState): void => {
    if (!localPlayerView) {
      createLocalView(player);
      return;
    }

    const localTransform = localPlayerView.getTransform();
    const shouldReconcileFromServer =
      squaredDistance(localTransform, player) >= LOCAL_SERVER_RECONCILE_DISTANCE_SQUARED ||
      Math.abs(localTransform.rotationY - player.rotationY) >= LOCAL_SERVER_RECONCILE_ROTATION_DELTA;

    if (!shouldReconcileFromServer) {
      return;
    }

    localPlayerView.updateFromState(player);

    logMatchView("[match][view:update]", {
      sessionId: player.sessionId,
      role: "local",
      rootNodeId: localPlayerView.rootNode.uniqueId,
      characterNodeId: localPlayerView.characterMesh.uniqueId,
      x: player.x,
      y: player.y,
      z: player.z
    });
  };

  const createRemoteView = (player: MatchPlayerState, role: RemotePlayerRole): void => {
    remoteViewsBySessionId.get(player.sessionId)?.dispose();

    const nextView = playerFactory.createRemotePlayerView(player, role);
    remoteViewsBySessionId.set(player.sessionId, nextView);
    remoteRoleBySessionId.set(player.sessionId, role);

    logMatchView("[match][view:create]", {
      sessionId: player.sessionId,
      role,
      nickname: player.nickname,
      rootNodeId: nextView.rootNode.uniqueId,
      characterNodeId: nextView.characterMesh.uniqueId,
      x: player.x,
      y: player.y,
      z: player.z
    });
  };

  const syncRemoteView = (player: MatchPlayerState, localUserId: string | null): void => {
    const nextRole = resolveRole(player, localUserId, teamMemberUserIds);
    const existingView = remoteViewsBySessionId.get(player.sessionId);
    const currentRole = remoteRoleBySessionId.get(player.sessionId);
    const shouldRecreate = !existingView || !currentRole || currentRole !== nextRole;

    if (shouldRecreate) {
      createRemoteView(player, nextRole);
      return;
    }

    existingView.updateFromState(player);

    logMatchView("[match][view:update]", {
      sessionId: player.sessionId,
      role: nextRole,
      rootNodeId: existingView.rootNode.uniqueId,
      characterNodeId: existingView.characterMesh.uniqueId,
      x: player.x,
      y: player.y,
      z: player.z
    });
  };

  const removeMissingPlayers = (activeSessionIds: Set<string>): void => {
    Array.from(playersBySessionId.keys()).forEach((sessionId) => {
      if (activeSessionIds.has(sessionId)) {
        return;
      }

      playersBySessionId.delete(sessionId);
    });
  };

  const removeMissingViews = (activeSessionIds: Set<string>): void => {
    if (localPlayerView && !activeSessionIds.has(options.localSessionId)) {
      logMatchView("[match][view:remove]", {
        sessionId: options.localSessionId,
        role: "local",
        rootNodeId: localPlayerView.rootNode.uniqueId,
        characterNodeId: localPlayerView.characterMesh.uniqueId
      });

      localPlayerView.dispose();
      localPlayerView = null;
    }

    Array.from(remoteViewsBySessionId.keys()).forEach((sessionId) => {
      if (activeSessionIds.has(sessionId)) {
        return;
      }

      const removedRole = remoteRoleBySessionId.get(sessionId);
      const removedView = remoteViewsBySessionId.get(sessionId);
      removedView?.dispose();
      remoteViewsBySessionId.delete(sessionId);
      remoteRoleBySessionId.delete(sessionId);

      if (!removedRole || !removedView) {
        return;
      }

      logMatchView("[match][view:remove]", {
        sessionId,
        role: removedRole,
        rootNodeId: removedView.rootNode.uniqueId,
        characterNodeId: removedView.characterMesh.uniqueId
      });
    });
  };

  return {
    syncPlayers: (players) => {
      const activeSessionIds = new Set<string>();
      const dirtySessionIds = new Set<string>();

      players.forEach((player) => {
        activeSessionIds.add(player.sessionId);
        const previousState = playersBySessionId.get(player.sessionId);
        if (didPlayerStateChange(previousState, player)) {
          dirtySessionIds.add(player.sessionId);
        }

        playersBySessionId.set(player.sessionId, clonePlayerState(player));
      });

      removeMissingPlayers(activeSessionIds);
      removeMissingViews(activeSessionIds);

      const localPlayerState = playersBySessionId.get(options.localSessionId) ?? null;
      if (
        localPlayerState &&
        (!localPlayerView || dirtySessionIds.has(options.localSessionId))
      ) {
        syncLocalView(localPlayerState);
      }

      const localUserId = localPlayerState?.userId ?? null;

      players.forEach((player) => {
        if (player.sessionId === options.localSessionId) {
          return;
        }

        if (!remoteViewsBySessionId.has(player.sessionId) || dirtySessionIds.has(player.sessionId)) {
          syncRemoteView(player, localUserId);
        }
      });
    },
    setTeamMemberUserIds: (userIds) => {
      teamMemberUserIds = new Set(userIds);

      const localUserId = getLocalPlayerState()?.userId ?? null;
      Array.from(playersBySessionId.values()).forEach((player) => {
        if (player.sessionId === options.localSessionId) {
          return;
        }

        syncRemoteView(player, localUserId);
      });
    },
    updateLocalPlayerTransform: (transform) => {
      const localPlayer = playersBySessionId.get(options.localSessionId);
      if (!localPlayerView || !localPlayer) {
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
    getLocalPlayerView: () => {
      return localPlayerView;
    },
    getLocalPlayerState,
    dispose: () => {
      localPlayerView?.dispose();
      localPlayerView = null;

      remoteViewsBySessionId.forEach((view) => {
        view.dispose();
      });

      remoteViewsBySessionId.clear();
      playersBySessionId.clear();
      remoteRoleBySessionId.clear();
    }
  };
}
