import { environment } from "@/config/env";
import { createEngine } from "@/core/engine/create-engine";
import { GameRuntime } from "@/core/runtime/game-runtime";
import { createSandboxSceneDefinition } from "@/game/bootstrap/create-sandbox-scene";

export interface GameAppOptions {
  canvas: HTMLCanvasElement;
}

export class GameApp {
  private readonly runtime: GameRuntime;

  private constructor(runtime: GameRuntime) {
    this.runtime = runtime;
  }

  static create(options: GameAppOptions): GameApp {
    const engine = createEngine(options.canvas, environment);
    const runtime = new GameRuntime(engine, options.canvas);

    return new GameApp(runtime);
  }

  async start(): Promise<void> {
    await this.runtime.loadScene(createSandboxSceneDefinition());
    this.runtime.start();
  }

  dispose(): void {
    this.runtime.dispose();
  }
}
