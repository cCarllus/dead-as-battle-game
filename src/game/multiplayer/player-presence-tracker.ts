// Responsável por rastrear presença de players por sessionId e expor mudanças de spawn/update/remove sem acoplamento à cena.
export type PresenceSource = "snapshot" | "stream";

export type PresenceDelta<Player extends { sessionId: string }> = {
  spawned: Player[];
  updated: Player[];
  removed: string[];
};

export type StreamPresenceChange<Player extends { sessionId: string }> = {
  type: "spawned" | "updated";
  player: Player;
};

export type PlayerPresenceTracker<Player extends { sessionId: string }> = {
  applySnapshot: (players: Player[]) => PresenceDelta<Player>;
  observe: (player: Player) => StreamPresenceChange<Player>;
  remove: (sessionId: string) => boolean;
  reset: () => void;
};

export function createPlayerPresenceTracker<Player extends { sessionId: string }>(): PlayerPresenceTracker<Player> {
  const knownSessionIds = new Set<string>();

  return {
    applySnapshot: (players) => {
      const nextKnownSessionIds = new Set<string>();
      const spawned: Player[] = [];
      const updated: Player[] = [];

      players.forEach((player) => {
        nextKnownSessionIds.add(player.sessionId);
        if (knownSessionIds.has(player.sessionId)) {
          updated.push(player);
          return;
        }

        spawned.push(player);
      });

      const removed: string[] = [];
      knownSessionIds.forEach((sessionId) => {
        if (!nextKnownSessionIds.has(sessionId)) {
          removed.push(sessionId);
        }
      });

      knownSessionIds.clear();
      nextKnownSessionIds.forEach((sessionId) => {
        knownSessionIds.add(sessionId);
      });

      return {
        spawned,
        updated,
        removed
      };
    },
    observe: (player) => {
      const type = knownSessionIds.has(player.sessionId) ? "updated" : "spawned";
      knownSessionIds.add(player.sessionId);
      return {
        type,
        player
      };
    },
    remove: (sessionId) => {
      return knownSessionIds.delete(sessionId);
    },
    reset: () => {
      knownSessionIds.clear();
    }
  };
}
