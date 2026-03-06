// Responsável por gerenciar presença multiplayer da sala global_match (join, snapshot, spawn e leave).
import { Client, Room } from "@colyseus/core";
import type { GlobalMatchState, MatchJoinOptions, MatchPlayerState } from "../models/match-player.model.js";
import { SpawnService } from "../services/spawn.service.js";

const DEFAULT_HERO_ID = "user";
const MAX_NICKNAME_LENGTH = 24;
const MATCH_SNAPSHOT_REQUEST_EVENT = "match:snapshot:request";
const MATCH_SNAPSHOT_EVENT = "match:snapshot";
const MATCH_PLAYER_JOINED_EVENT = "match:player:joined";
const MATCH_PLAYER_LEFT_EVENT = "match:player:left";

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

function normalizeSelectedHeroId(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return DEFAULT_HERO_ID;
  }

  return VALID_HERO_IDS.has(normalized) ? normalized : DEFAULT_HERO_ID;
}

function clonePlayer(player: MatchPlayerState): MatchPlayerState {
  return {
    ...player,
    position: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    }
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

export class GlobalMatchRoom extends Room {
  private readonly spawnService = new SpawnService();

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
    void this.syncLobbyMetadata();

    this.onMessage(MATCH_SNAPSHOT_REQUEST_EVENT, (client) => {
      client.send(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
    });
  }

  async onJoin(client: Client, options?: MatchJoinOptions): Promise<void> {
    const userId = normalizeText(options?.userId);
    const nickname = normalizeNickname(options?.nickname);

    if (!userId || !nickname) {
      throw new Error("Invalid join payload. 'userId' and 'nickname' are required.");
    }

    const selectedHeroId = normalizeSelectedHeroId(options?.selectedHeroId);
    const spawnPosition = this.spawnService.getNextSpawnPoint();

    const player: MatchPlayerState = {
      sessionId: client.sessionId,
      userId,
      nickname,
      selectedHeroId,
      position: spawnPosition,
      joinedAt: Date.now()
    };

    this.matchState.players[client.sessionId] = player;
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
    await this.syncLobbyMetadata();

    this.broadcast(MATCH_PLAYER_LEFT_EVENT, {
      sessionId: client.sessionId,
      userId: player.userId,
      leftAt: Date.now()
    });
    this.broadcast(MATCH_SNAPSHOT_EVENT, cloneState(this.matchState));
  }
}
