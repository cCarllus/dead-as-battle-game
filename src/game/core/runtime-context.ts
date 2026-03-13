// Responsável por compor bus de eventos, registry de serviços e máquina de estado em um contexto explícito de runtime.
import { createEventBus, type EventBus, type EventMap } from "./event-bus";
import { createGameStateMachine, type GameStateMachine } from "./game-state-machine";
import { createServiceRegistry, type ServiceMap, type ServiceRegistry } from "./service-registry";

export type RuntimeContextOptions<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string
> = {
  id: string;
  initialState: State;
  metadata?: Record<string, unknown>;
  canTransition?: (currentState: State, nextState: State) => boolean;
};

export type RuntimeContext<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string
> = {
  id: string;
  metadata: Readonly<Record<string, unknown>>;
  services: ServiceRegistry<Services>;
  events: EventBus<Events>;
  state: GameStateMachine<State>;
  dispose: () => void;
};

export function createRuntimeContext<
  Services extends ServiceMap,
  Events extends EventMap,
  State extends string
>(options: RuntimeContextOptions<Services, Events, State>): RuntimeContext<Services, Events, State> {
  const services = createServiceRegistry<Services>();
  const events = createEventBus<Events>();
  const state = createGameStateMachine<State>({
    initialState: options.initialState,
    canTransition: options.canTransition
  });

  return {
    id: options.id,
    metadata: Object.freeze({
      ...options.metadata
    }),
    services,
    events,
    state,
    dispose: () => {
      services.clear();
      events.dispose();
      state.dispose();
    }
  };
}
