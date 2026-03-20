import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";

import type { GameSceneDefinition } from "@/core/scene/scene-contract";

export class GameRuntime {
  private activeScene: Scene | null = null;
  private started = false;
  private readonly resizeHandler = (): void => {
    this.engine.resize();
  };

  constructor(
    public readonly engine: Engine,
    public readonly canvas: HTMLCanvasElement
  ) {}

  get scene(): Scene {
    if (!this.activeScene) {
      throw new Error("No active Babylon scene is loaded.");
    }

    return this.activeScene;
  }

  private static toMetadataRecord(value: unknown): Record<string, unknown> {
    if (typeof value === "object" && value !== null) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  async loadScene(definition: GameSceneDefinition): Promise<Scene> {
    const nextScene = await definition.create(this);
    const previousScene = this.activeScene;
    const existingMetadata = GameRuntime.toMetadataRecord(nextScene.metadata as unknown);

    nextScene.metadata = {
      ...existingMetadata,
      sceneId: definition.id
    };

    this.activeScene = nextScene;
    previousScene?.dispose();

    return nextScene;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    window.addEventListener("resize", this.resizeHandler);
    this.engine.runRenderLoop(() => {
      this.activeScene?.render();
    });
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    window.removeEventListener("resize", this.resizeHandler);
    this.engine.stopRenderLoop();
  }

  dispose(): void {
    this.stop();
    this.activeScene?.dispose();
    this.activeScene = null;
    this.engine.dispose();
  }
}
