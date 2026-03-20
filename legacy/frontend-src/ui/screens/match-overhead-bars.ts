// Responsible for floating health bars above other players, including creation, positioning, and cleanup.
import { MATCH_UI_CONFIG } from "../../game/config/ui.config";
import type { MatchPlayerState } from "../../models/match-player.model";

const MATCH_OVERHEAD_BAR_RANGE_METERS = MATCH_UI_CONFIG.overheadBars.rangeMeters;

export type MatchOverheadBarKind = "ally" | "enemy";

export type MatchOverheadBarEntry = {
  sessionId: string;
  element: HTMLDivElement;
  levelNode: HTMLSpanElement;
  nameNode: HTMLSpanElement;
  healthFillNode: HTMLSpanElement;
};

export type MatchOverheadBarsOptions = {
  hudOverheadBarsLayer: HTMLElement;
  getLocalSessionId: () => string | null;
  getPlayers: () => MatchPlayerState[];
  getPlayerWorldPosition: (sessionId: string) => { x: number; y: number; z: number } | null;
  getPlayerNameplateScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  isTeamMember: (userId: string) => boolean;
};

export type MatchOverheadBarsHandle = {
  update(): void;
  dispose(): void;
};

export function createMatchOverheadBars(options: MatchOverheadBarsOptions): MatchOverheadBarsHandle {
  const overheadBarsBySessionId = new Map<string, MatchOverheadBarEntry>();
  let overheadBarsFrameId: number | null = null;

  const removeOverheadBar = (sessionId: string): void => {
    const entry = overheadBarsBySessionId.get(sessionId);
    if (!entry) {
      return;
    }

    entry.element.remove();
    overheadBarsBySessionId.delete(sessionId);
  };

  const clearOverheadBars = (): void => {
    overheadBarsBySessionId.forEach((entry) => {
      entry.element.remove();
    });
    overheadBarsBySessionId.clear();
  };

  const ensureOverheadBar = (player: MatchPlayerState, kind: MatchOverheadBarKind): MatchOverheadBarEntry => {
    const existing = overheadBarsBySessionId.get(player.sessionId);
    if (existing) {
      existing.element.className = `dab-match__overhead-bar is-${kind}`;
      existing.levelNode.textContent = `LVL ${player.heroLevel}`;
      existing.nameNode.textContent = player.nickname;
      return existing;
    }

    const element = document.createElement("div");
    element.className = `dab-match__overhead-bar is-${kind}`;

    const titleRow = document.createElement("div");
    titleRow.className = "dab-match__overhead-title";

    const levelNode = document.createElement("span");
    levelNode.className = "dab-match__overhead-level";
    levelNode.textContent = `LVL ${player.heroLevel}`;

    const nameNode = document.createElement("span");
    nameNode.className = "dab-match__overhead-name";
    nameNode.textContent = player.nickname;

    const healthTrack = document.createElement("div");
    healthTrack.className = "dab-match__overhead-health-track";

    const healthPulse = document.createElement("span");
    healthPulse.className = "dab-match__overhead-health-pulse";

    const healthFillNode = document.createElement("span");
    healthFillNode.className = "dab-match__overhead-health-fill";

    healthTrack.append(healthPulse, healthFillNode);
    titleRow.append(levelNode, nameNode);
    element.append(titleRow, healthTrack);
    options.hudOverheadBarsLayer.appendChild(element);

    const entry: MatchOverheadBarEntry = {
      sessionId: player.sessionId,
      element,
      levelNode,
      nameNode,
      healthFillNode
    };
    overheadBarsBySessionId.set(player.sessionId, entry);
    return entry;
  };

  const renderOverheadBars = (): void => {
    const players = options.getPlayers();
    const localSessionId = options.getLocalSessionId();
    if (!localSessionId) {
      overheadBarsBySessionId.forEach((entry) => {
        entry.element.classList.remove("is-visible");
      });
      overheadBarsFrameId = window.requestAnimationFrame(renderOverheadBars);
      return;
    }

    const localPlayer = players.find((player) => player.sessionId === localSessionId) ?? null;
    const localPosition =
      localPlayer
        ? options.getPlayerWorldPosition(localPlayer.sessionId) ?? { x: localPlayer.x, y: localPlayer.y, z: localPlayer.z }
        : null;

    if (!localPosition) {
      clearOverheadBars();
      overheadBarsFrameId = window.requestAnimationFrame(renderOverheadBars);
      return;
    }

    const activeSessionIds = new Set<string>();

    players.forEach((player) => {
      if (player.sessionId === localSessionId || !player.isAlive) {
        return;
      }

      const worldPosition = options.getPlayerWorldPosition(player.sessionId) ?? {
        x: player.x,
        y: player.y,
        z: player.z
      };
      const deltaX = worldPosition.x - localPosition.x;
      const deltaY = worldPosition.y - localPosition.y;
      const deltaZ = worldPosition.z - localPosition.z;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
      const distanceMeters = Math.sqrt(distanceSquared);
      const distanceRatio = Math.min(1, distanceMeters / MATCH_OVERHEAD_BAR_RANGE_METERS);
      const scale = Math.max(0.58, 1 - distanceRatio * 0.42);
      const screenPosition = options.getPlayerNameplateScreenPosition(player.sessionId);
      const isVisible = !!screenPosition && distanceSquared <= MATCH_OVERHEAD_BAR_RANGE_METERS * MATCH_OVERHEAD_BAR_RANGE_METERS;
      const kind: MatchOverheadBarKind = options.isTeamMember(player.userId) ? "ally" : "enemy";
      const entry = ensureOverheadBar(player, kind);
      const safeHealthPercent =
        player.maxHealth > 0 ? Math.max(0, Math.min(100, (player.currentHealth / player.maxHealth) * 100)) : 0;

      entry.levelNode.textContent = `LVL ${player.heroLevel}`;
      entry.nameNode.textContent = player.nickname;
      entry.healthFillNode.style.width = `${safeHealthPercent.toFixed(2)}%`;
      entry.element.className = `dab-match__overhead-bar is-${kind}${isVisible ? " is-visible" : ""}`;

      if (isVisible && screenPosition) {
        entry.element.style.setProperty("--dab-overhead-x", `${screenPosition.x}px`);
        entry.element.style.setProperty("--dab-overhead-y", `${screenPosition.y - 6}px`);
        entry.element.style.setProperty("--dab-overhead-scale", scale.toFixed(3));
      }

      activeSessionIds.add(player.sessionId);
    });

    overheadBarsBySessionId.forEach((entry, sessionId) => {
      if (activeSessionIds.has(sessionId)) {
        return;
      }

      removeOverheadBar(sessionId);
    });

    overheadBarsFrameId = window.requestAnimationFrame(renderOverheadBars);
  };

  return {
    update() {
      if (overheadBarsFrameId === null) {
        renderOverheadBars();
      }
    },
    dispose() {
      if (overheadBarsFrameId !== null) {
        window.cancelAnimationFrame(overheadBarsFrameId);
        overheadBarsFrameId = null;
      }
      clearOverheadBars();
    }
  };
}
