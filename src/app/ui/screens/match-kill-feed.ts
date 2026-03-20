// Responsible for the kill feed overlay: displaying recent kills with enter/fade animations.
import { MATCH_UI_CONFIG } from "@/config/ui.config";

const MATCH_KILL_FEED_MAX_ITEMS = MATCH_UI_CONFIG.killFeed.maxItems;
const MATCH_KILL_FEED_TTL_MS = MATCH_UI_CONFIG.killFeed.ttlMs;
const MATCH_KILL_FEED_FADE_WINDOW_MS = MATCH_UI_CONFIG.killFeed.fadeWindowMs;
const MATCH_KILL_FEED_ENTER_MS = MATCH_UI_CONFIG.killFeed.enterMs;

export type MatchKillFeedEntry = {
  id: string;
  killerSessionId: string;
  victimSessionId: string;
  killerName: string;
  victimName: string;
  timestamp: number;
  createdAt: number;
  expiresAt: number;
};

export type MatchKillFeedOptions = {
  hudKillLog: HTMLElement;
  getLocalSessionId: () => string | null;
};

export type MatchKillFeedHandle = {
  addKill(entry: {
    killerSessionId: string;
    victimSessionId: string;
    killerName: string;
    victimName: string;
    timestamp: number;
  }): void;
  tick(now: number): void;
  dispose(): void;
};

export function createMatchKillFeed(options: MatchKillFeedOptions): MatchKillFeedHandle {
  let killFeedEntries: MatchKillFeedEntry[] = [];

  const pruneKillFeedEntries = (now: number): void => {
    killFeedEntries = killFeedEntries.filter((entry) => entry.expiresAt > now).slice(0, MATCH_KILL_FEED_MAX_ITEMS);
  };

  const renderKillFeed = (): void => {
    const now = Date.now();
    const localSessionId = options.getLocalSessionId();
    pruneKillFeedEntries(now);
    options.hudKillLog.replaceChildren();

    killFeedEntries.forEach((entry) => {
      const enterProgress = Math.max(0, Math.min(1, (now - entry.createdAt) / MATCH_KILL_FEED_ENTER_MS));
      const timeRemainingMs = Math.max(0, entry.expiresAt - now);
      const fadeProgress =
        timeRemainingMs >= MATCH_KILL_FEED_FADE_WINDOW_MS
          ? 1
          : Math.max(0, timeRemainingMs / MATCH_KILL_FEED_FADE_WINDOW_MS);
      const opacity = Math.max(0, Math.min(1, fadeProgress * enterProgress));
      const offsetY = (1 - enterProgress) * -10;

      const item = document.createElement("div");
      item.className = "dab-match__kill-feed-item";
      item.style.setProperty("--dab-kill-feed-opacity", opacity.toFixed(3));
      item.style.setProperty("--dab-kill-feed-offset", `${offsetY.toFixed(2)}px`);

      const killer = document.createElement("span");
      killer.className = `dab-match__kill-feed-player ${
        entry.killerSessionId === localSessionId ? "is-local" : "is-enemy"
      }`;
      killer.textContent = entry.killerName;

      const icon = document.createElement("span");
      icon.className = "dab-match__kill-feed-icon";
      icon.textContent = "\u2297";

      const victim = document.createElement("span");
      victim.className = `dab-match__kill-feed-player ${
        entry.victimSessionId === localSessionId ? "is-local" : "is-enemy"
      }`;
      victim.textContent = entry.victimName;

      item.append(killer, icon, victim);
      options.hudKillLog.appendChild(item);
    });
  };

  return {
    addKill(payload) {
      const now = Date.now();
      killFeedEntries = [
        {
          id: `${payload.timestamp}:${payload.killerSessionId}:${payload.victimSessionId}`,
          killerSessionId: payload.killerSessionId,
          victimSessionId: payload.victimSessionId,
          killerName: payload.killerName,
          victimName: payload.victimName,
          timestamp: payload.timestamp,
          createdAt: now,
          expiresAt: now + MATCH_KILL_FEED_TTL_MS
        },
        ...killFeedEntries
      ].slice(0, MATCH_KILL_FEED_MAX_ITEMS);

      renderKillFeed();
    },
    tick(_now: number) {
      renderKillFeed();
    },
    dispose() {
      killFeedEntries = [];
      options.hudKillLog.replaceChildren();
    }
  };
}
