// Responsável por especializar o runtime context para cenas/gameplays com metadados explícitos de sessão.
import {
  canTransitionGameFlowState,
  GAME_FLOW_STATES,
  type GameFlowState
} from "./game-state-machine";
import {
  createRuntimeContext,
  type RuntimeContext,
  type RuntimeContextOptions
} from "./runtime-context";
import type { EventMap } from "./event-bus";
import type { ServiceMap } from "./service-registry";

export type CreateGameContextOptions<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string = GameFlowState
> = Omit<RuntimeContextOptions<Services, Events, State>, "id" | "canTransition"> & {
  sceneId: string;
  localSessionId?: string | null;
  canTransition?: (currentState: State, nextState: State) => boolean;
};

export type GameContext<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string = GameFlowState
> = RuntimeContext<Services, Events, State> & {
  sceneId: string;
  getLocalSessionId: () => string | null;
};

export function createGameContext<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string = GameFlowState
>(options: CreateGameContextOptions<Services, Events, State>): GameContext<Services, Events, State> {
  const localSessionId = options.localSessionId ?? null;
  const gameFlowStateSet = new Set<string>(GAME_FLOW_STATES);
  const runtimeContext = createRuntimeContext<Services, Events, State>({
    id: options.sceneId,
    initialState: options.initialState,
    metadata: {
      sceneId: options.sceneId,
      localSessionId,
      ...options.metadata
    },
    canTransition:
      options.canTransition ??
      (((currentState, nextState) => {
        const currentStateKey = String(currentState);
        const nextStateKey = String(nextState);
        if (gameFlowStateSet.has(currentStateKey) && gameFlowStateSet.has(nextStateKey)) {
          return canTransitionGameFlowState(
            currentStateKey as GameFlowState,
            nextStateKey as GameFlowState
          );
        }

        return currentState === nextState;
      }) as (currentState: State, nextState: State) => boolean)
  });

  return {
    ...runtimeContext,
    sceneId: options.sceneId,
    getLocalSessionId: () => localSessionId
  };
}
