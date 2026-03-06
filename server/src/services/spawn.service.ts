// Responsável por distribuir pontos de spawn em round-robin para novos jogadores da partida global.
import type { MatchPosition } from "../models/match-player.model.js";

const DEFAULT_SPAWN_POINTS: readonly MatchPosition[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4, y: 0, z: 0 },
  { x: -4, y: 0, z: 0 },
  { x: 0, y: 0, z: 4 },
  { x: 0, y: 0, z: -4 },
  { x: 6, y: 0, z: 6 }
] as const;

export class SpawnService {
  private nextSpawnIndex = 0;

  constructor(private readonly spawnPoints: readonly MatchPosition[] = DEFAULT_SPAWN_POINTS) {
    if (spawnPoints.length === 0) {
      throw new Error("SpawnService requires at least one spawn point.");
    }
  }

  getNextSpawnPoint(): MatchPosition {
    const spawnPoint = this.spawnPoints[this.nextSpawnIndex % this.spawnPoints.length];
    this.nextSpawnIndex += 1;

    return {
      x: spawnPoint.x,
      y: spawnPoint.y,
      z: spawnPoint.z
    };
  }
}
