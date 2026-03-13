// Responsável por publicar sinais tipados entre sistemas sem acoplamento direto entre runtime, HUD e serviços.
export type EventMap = Record<string, unknown>;

export type EventListener<Payload> = (payload: Payload) => void;

export type EventBus<Events extends EventMap> = {
  emit: <EventName extends keyof Events>(eventName: EventName, payload: Events[EventName]) => void;
  on: <EventName extends keyof Events>(
    eventName: EventName,
    listener: EventListener<Events[EventName]>
  ) => () => void;
  once: <EventName extends keyof Events>(
    eventName: EventName,
    listener: EventListener<Events[EventName]>
  ) => () => void;
  clear: <EventName extends keyof Events>(eventName?: EventName) => void;
  dispose: () => void;
};

export function createEventBus<Events extends EventMap>(): EventBus<Events> {
  const listenersByEvent = new Map<keyof Events, Set<EventListener<unknown>>>();

  const ensureListeners = <EventName extends keyof Events>(
    eventName: EventName
  ): Set<EventListener<unknown>> => {
    let listeners = listenersByEvent.get(eventName);
    if (!listeners) {
      listeners = new Set<EventListener<unknown>>();
      listenersByEvent.set(eventName, listeners);
    }

    return listeners;
  };

  return {
    emit: (eventName, payload) => {
      const listeners = listenersByEvent.get(eventName);
      if (!listeners || listeners.size === 0) {
        return;
      }

      listeners.forEach((listener) => {
        (listener as EventListener<Events[typeof eventName]>)(payload);
      });
    },
    on: (eventName, listener) => {
      const listeners = ensureListeners(eventName);
      listeners.add(listener as EventListener<unknown>);
      return () => {
        listeners.delete(listener as EventListener<unknown>);
        if (listeners.size === 0) {
          listenersByEvent.delete(eventName);
        }
      };
    },
    once: (eventName, listener) => {
      let unsubscribe = () => {
        // Replaced immediately after the listener is registered.
      };
      const wrappedListener: EventListener<Events[typeof eventName]> = (payload) => {
        unsubscribe();
        listener(payload);
      };

      const listeners = ensureListeners(eventName);
      listeners.add(wrappedListener as EventListener<unknown>);
      unsubscribe = () => {
        listeners.delete(wrappedListener as EventListener<unknown>);
        if (listeners.size === 0) {
          listenersByEvent.delete(eventName);
        }
      };

      return unsubscribe;
    },
    clear: (eventName) => {
      if (typeof eventName === "undefined") {
        listenersByEvent.clear();
        return;
      }

      listenersByEvent.delete(eventName);
    },
    dispose: () => {
      listenersByEvent.clear();
    }
  };
}
