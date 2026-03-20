import type { Scene } from "@babylonjs/core/scene";

import type { GameRuntime } from "@/core/runtime/game-runtime";

export interface GameSceneDefinition {
  readonly id: string;
  create(runtime: GameRuntime): Scene | Promise<Scene>;
}
