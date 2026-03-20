// Responsável por criar engine, scene e runtime context explícitos para cenas de gameplay sem singletons globais.
import {
  Color4,
  Engine,
  Scene,
  type EngineOptions
} from "@babylonjs/core";
import type { EventMap } from "./event-bus";
import { createGameContext, type CreateGameContextOptions, type GameContext } from "./game-context";
import type { ServiceMap } from "./service-registry";

export type GameBootstrapOptions<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string
> = Omit<CreateGameContextOptions<Services, Events, State>, "sceneId"> & {
  canvas: HTMLCanvasElement;
  sceneId: string;
  clearColor?: Color4;
  engineOptions?: EngineOptions;
};

export type GameBootstrap<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string
> = {
  engine: Engine;
  scene: Scene;
  context: GameContext<Services, Events, State>;
};

const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  antialias: true,
  preserveDrawingBuffer: false,
  stencil: true
};

export function createGameBootstrap<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string
>(options: GameBootstrapOptions<Services, Events, State>): GameBootstrap<Services, Events, State> {
  const engine = new Engine(options.canvas, true, {
    ...DEFAULT_ENGINE_OPTIONS,
    ...options.engineOptions
  });
  const scene = new Scene(engine);

  if (options.clearColor) {
    scene.clearColor = options.clearColor.clone();
  }

  const context = createGameContext<Services, Events, State>({
    sceneId: options.sceneId,
    localSessionId: options.localSessionId,
    initialState: options.initialState,
    metadata: options.metadata,
    canTransition: options.canTransition
  });

  return {
    engine,
    scene,
    context
  };
}
