// Responsável por formalizar transições explícitas de ciclo de vida do jogo sem espalhar flags de estado.
export const GAME_FLOW_STATES = [
  "Boot",
  "Menu",
  "Loading",
  "InMatch",
  "Paused",
  "Respawn",
  "Disposed"
] as const;

export type GameFlowState = (typeof GAME_FLOW_STATES)[number];

export type GameStateTransition<State extends string> = {
  from: State;
  to: State;
  at: number;
  reason: string | null;
};

export type GameStateTransitionListener<State extends string> = (
  transition: GameStateTransition<State>
) => void;

export type GameStateMachine<State extends string> = {
  getState: () => State;
  canTransitionTo: (nextState: State) => boolean;
  transitionTo: (nextState: State, reason?: string) => State;
  reset: (nextState: State) => void;
  onTransition: (listener: GameStateTransitionListener<State>) => () => void;
  dispose: () => void;
};

export type CreateGameStateMachineOptions<State extends string> = {
  initialState: State;
  canTransition?: (currentState: State, nextState: State) => boolean;
};

const DEFAULT_GAME_FLOW_TRANSITIONS: Record<GameFlowState, readonly GameFlowState[]> = {
  Boot: ["Loading", "Menu", "Disposed"],
  Menu: ["Loading", "Disposed"],
  Loading: ["Menu", "InMatch", "Respawn", "Disposed"],
  InMatch: ["Paused", "Respawn", "Menu", "Disposed"],
  Paused: ["InMatch", "Menu", "Disposed"],
  Respawn: ["Loading", "InMatch", "Menu", "Disposed"],
  Disposed: []
};

export function canTransitionGameFlowState(
  currentState: GameFlowState,
  nextState: GameFlowState
): boolean {
  return DEFAULT_GAME_FLOW_TRANSITIONS[currentState].includes(nextState);
}

export function createGameStateMachine<State extends string>(
  options: CreateGameStateMachineOptions<State>
): GameStateMachine<State> {
  const listeners = new Set<GameStateTransitionListener<State>>();
  let currentState = options.initialState;

  return {
    getState: () => currentState,
    canTransitionTo: (nextState) => {
      if (currentState === nextState) {
        return true;
      }

      if (!options.canTransition) {
        return true;
      }

      return options.canTransition(currentState, nextState);
    },
    transitionTo: (nextState, reason) => {
      if (!options.canTransition) {
        const previousState = currentState;
        currentState = nextState;
        listeners.forEach((listener) => {
          listener({
            from: previousState,
            to: nextState,
            at: Date.now(),
            reason: reason ?? null
          });
        });
        return currentState;
      }

      if (!options.canTransition(currentState, nextState)) {
        throw new Error(
          `[game][state] Invalid transition '${String(currentState)}' -> '${String(nextState)}'.`
        );
      }

      const previousState = currentState;
      currentState = nextState;
      listeners.forEach((listener) => {
        listener({
          from: previousState,
          to: nextState,
          at: Date.now(),
          reason: reason ?? null
        });
      });
      return currentState;
    },
    reset: (nextState) => {
      currentState = nextState;
    },
    onTransition: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      listeners.clear();
    }
  };
}
