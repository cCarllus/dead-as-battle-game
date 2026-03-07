// Responsável por manter estado autoritativo de jogadores da global_match e sincronizar posição entre clientes.
import { Client, Room } from "@colyseus/core";
import type {
  GlobalMatchState,
  MatchJoinOptions,
  MatchMovePayload,
  MatchPlayerState
} from "../models/match-player.model.js";
import { SpawnService } from "../services/spawn.service.js";

const DEFAULT_HERO_ID = "user";
const MAX_NICKNAME_LENGTH = 24;
const MATCH_SNAPSHOT_REQUEST_EVENT = "match:snapshot:request";
const MATCH_SNAPSHOT_EVENT = "match:snapshot";
const MATCH_PLAYER_JOINED_EVENT = "match:player:joined";
const MATCH_PLAYER_LEFT_EVENT = "match:player:left";
const MATCH_PLAYER_MOVE_EVENT = "player_move";
const MATCH_PLAYER_MOVED_EVENT = "match:player:moved";
const MATCH_STATE_SYNC_INTERVAL_MS = 120;

const VALID_HERO_IDS = new Set<string>(["user", "sukuna", "kaiju_no_8"]);

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

export class GlobalMatchRoom extends Room {
  private readonly spawnService = new SpawnService();
  private stateDirty = false;

  private get matchState(): GlobalMatchState {
    return this.state as GlobalMatchState;
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
    void this.syncLobbyMetadata();

    this.onMessage(MATCH_SNAPSHOT_REQUEST_EVENT, (client) => {
      client.send(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
    });

    this.onMessage(MATCH_PLAYER_MOVE_EVENT, (client, payload: MatchMovePayload) => {
      this.handlePlayerMove(client, payload);
    });

    this.clock.setInterval(() => {
      if (!this.stateDirty) {
        return;
      }

      this.broadcast(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
      this.stateDirty = false;
    }, MATCH_STATE_SYNC_INTERVAL_MS);
  }

  async onJoin(client: Client, options?: MatchJoinOptions): Promise<void> {
    const userId = normalizeText(options?.userId);
    const nickname = normalizeNickname(options?.nickname);

    if (!userId || !nickname) {
      throw new Error("Invalid join payload. 'userId' and 'nickname' are required.");
    }

    const heroId = normalizeHeroId(options?.heroId);
    const spawn = this.spawnService.getNextSpawnPoint();

    const player: MatchPlayerState = {
      sessionId: client.sessionId,
      userId,
      nickname,
      heroId,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      rotationY: 0,
      joinedAt: Date.now()
    };

    this.matchState.players[client.sessionId] = player;
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
    this.stateDirty = true;
    await this.syncLobbyMetadata();

    this.broadcast(MATCH_PLAYER_LEFT_EVENT, {
      sessionId: client.sessionId,
      userId: player.userId,
      leftAt: Date.now()
    });
    this.broadcast(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
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

    player.x = normalizedMove.x;
    player.y = normalizedMove.y;
    player.z = normalizedMove.z;
    player.rotationY = normalizedMove.rotationY;
    this.stateDirty = true;

    this.broadcast(
      MATCH_PLAYER_MOVED_EVENT,
      {
        sessionId: player.sessionId,
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY
      },
      { except: client }
    );
  }
}
