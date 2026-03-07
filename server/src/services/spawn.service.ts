// Responsável por distribuir pontos de spawn em round-robin para novos jogadores da partida global.
type SpawnPoint = {
  x: number;
  y: number;
  z: number;
};

const DEFAULT_SPAWN_POINTS: readonly SpawnPoint[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4, y: 0, z: 0 },
  { x: -4, y: 0, z: 0 },
  { x: 0, y: 0, z: 4 },
  { x: 0, y: 0, z: -4 },
  { x: 6, y: 0, z: 6 }
] as const;

export class SpawnService {
  private nextSpawnIndex = 0;

  constructor(private readonly spawnPoints: readonly SpawnPoint[] = DEFAULT_SPAWN_POINTS) {
    if (spawnPoints.length === 0) {
      throw new Error("SpawnService requires at least one spawn point.");
    }
  }

  getNextSpawnPoint(): SpawnPoint {
    const spawnPoint = this.spawnPoints[this.nextSpawnIndex % this.spawnPoints.length];
    this.nextSpawnIndex += 1;

    return {
      x: spawnPoint.x,
      y: spawnPoint.y,
      z: spawnPoint.z
    };
  }
}
