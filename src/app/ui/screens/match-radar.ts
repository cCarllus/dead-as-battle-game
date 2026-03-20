// Responsible for the minimap radar system: compass directions, player markers, and radar projection.
import { MATCH_UI_CONFIG } from "@/config/ui.config";
import type { MatchPlayerState } from "@/shared/match/match-player.model";

const MATCH_RADAR_RANGE_METERS = MATCH_UI_CONFIG.radar.rangeMeters;
const MATCH_RADAR_MAX_MARKERS = MATCH_UI_CONFIG.radar.maxMarkers;
const MATCH_RADAR_MARKER_EDGE_PADDING_PX = MATCH_UI_CONFIG.radar.markerEdgePaddingPx;
const MATCH_RADAR_COMPASS_RADIUS_RATIO = MATCH_UI_CONFIG.radar.compassRadiusRatio;

export type MatchRadarMarkerKind = "ally" | "enemy";

function normalizeForward(forward: { x: number; z: number } | null): { x: number; z: number } {
  if (!forward) {
    return { x: 0, z: 1 };
  }

  const length = Math.hypot(forward.x, forward.z);
  if (length <= 0.0001) {
    return { x: 0, z: 1 };
  }

  return {
    x: forward.x / length,
    z: forward.z / length
  };
}

function projectToRadarPlane(options: {
  deltaX: number;
  deltaZ: number;
  forwardX: number;
  forwardZ: number;
  maxRadiusPx: number;
  radarRangeMeters: number;
}): { x: number; y: number } {
  const rightX = options.forwardZ;
  const rightZ = -options.forwardX;
  let projectedX = ((options.deltaX * rightX + options.deltaZ * rightZ) / options.radarRangeMeters) * options.maxRadiusPx;
  let projectedY =
    (-(options.deltaX * options.forwardX + options.deltaZ * options.forwardZ) / options.radarRangeMeters) *
    options.maxRadiusPx;

  const projectedLength = Math.hypot(projectedX, projectedY);
  if (projectedLength > options.maxRadiusPx && projectedLength > 0.0001) {
    const clampFactor = options.maxRadiusPx / projectedLength;
    projectedX *= clampFactor;
    projectedY *= clampFactor;
  }

  return {
    x: projectedX,
    y: projectedY
  };
}

export type MatchRadarOptions = {
  hudRadarDisc: HTMLElement;
  hudRadarMarkers: HTMLElement;
  hudRadarNorth: HTMLElement;
  hudRadarEast: HTMLElement;
  hudRadarSouth: HTMLElement;
  hudRadarWest: HTMLElement;
  getLocalSessionId: () => string | null;
  getPlayers: () => MatchPlayerState[];
  getCameraGroundForward: () => { x: number; z: number } | null;
  getPlayerWorldPosition: (sessionId: string) => { x: number; y: number; z: number } | null;
  isTeamMember: (userId: string) => boolean;
  getFallbackForward: () => { x: number; z: number };
};

export type MatchRadarHandle = {
  update(): void;
  dispose(): void;
};

export function createMatchRadar(options: MatchRadarOptions): MatchRadarHandle {
  const radarMarkersBySessionId = new Map<string, HTMLSpanElement>();
  let radarFrameId: number | null = null;

  const clearRadarMarkers = (): void => {
    radarMarkersBySessionId.forEach((marker) => {
      marker.remove();
    });
    radarMarkersBySessionId.clear();
  };

  const positionRadarDirection = (
    element: HTMLElement,
    vector: { x: number; z: number },
    forward: { x: number; z: number },
    compassRadiusPx: number
  ): void => {
    const projection = projectToRadarPlane({
      deltaX: vector.x,
      deltaZ: vector.z,
      forwardX: forward.x,
      forwardZ: forward.z,
      maxRadiusPx: compassRadiusPx,
      radarRangeMeters: 1
    });

    element.style.transform = `translate3d(calc(-50% + ${projection.x.toFixed(2)}px), calc(-50% + ${projection.y.toFixed(
      2
    )}px), 0)`;
  };

  const resolveRadarPlayerPosition = (player: MatchPlayerState): { x: number; y: number; z: number } => {
    return options.getPlayerWorldPosition(player.sessionId) ?? {
      x: player.x,
      y: player.y,
      z: player.z
    };
  };

  const ensureRadarMarker = (
    sessionId: string,
    nickname: string,
    kind: MatchRadarMarkerKind
  ): HTMLSpanElement => {
    const existing = radarMarkersBySessionId.get(sessionId);
    if (existing) {
      existing.className = `dab-match__radar-marker is-dynamic is-${kind}`;
      existing.setAttribute("aria-label", nickname);
      existing.title = nickname;
      return existing;
    }

    const marker = document.createElement("span");
    marker.className = `dab-match__radar-marker is-dynamic is-${kind}`;
    marker.setAttribute("aria-label", nickname);
    marker.title = nickname;
    options.hudRadarMarkers.appendChild(marker);
    radarMarkersBySessionId.set(sessionId, marker);
    return marker;
  };

  const renderRadar = (): void => {
    const discRadiusPx = options.hudRadarDisc.clientWidth * 0.5;
    const markerRadiusPx = Math.max(0, discRadiusPx - MATCH_RADAR_MARKER_EDGE_PADDING_PX);
    const compassRadiusPx = Math.max(18, discRadiusPx * MATCH_RADAR_COMPASS_RADIUS_RATIO);
    const forward = normalizeForward(options.getCameraGroundForward() ?? options.getFallbackForward());

    positionRadarDirection(options.hudRadarNorth, { x: 0, z: 1 }, forward, compassRadiusPx);
    positionRadarDirection(options.hudRadarEast, { x: 1, z: 0 }, forward, compassRadiusPx);
    positionRadarDirection(options.hudRadarSouth, { x: 0, z: -1 }, forward, compassRadiusPx);
    positionRadarDirection(options.hudRadarWest, { x: -1, z: 0 }, forward, compassRadiusPx);

    const localSessionId = options.getLocalSessionId();
    if (!localSessionId || markerRadiusPx <= 0) {
      clearRadarMarkers();
      radarFrameId = window.requestAnimationFrame(renderRadar);
      return;
    }

    const players = options.getPlayers();
    const localPlayer = players.find((player) => player.sessionId === localSessionId) ?? null;
    const localPosition = localPlayer ? resolveRadarPlayerPosition(localPlayer) : null;
    if (!localPosition) {
      clearRadarMarkers();
      radarFrameId = window.requestAnimationFrame(renderRadar);
      return;
    }

    const visibleIds = new Set<string>();
    const visiblePlayers = players
      .filter((player) => player.sessionId !== localSessionId && player.isAlive)
      .map((player) => {
        const position = resolveRadarPlayerPosition(player);
        const deltaX = position.x - localPosition.x;
        const deltaZ = position.z - localPosition.z;
        const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
        return {
          player,
          deltaX,
          deltaZ,
          distanceSquared
        };
      })
      .filter((entry) => entry.distanceSquared <= MATCH_RADAR_RANGE_METERS * MATCH_RADAR_RANGE_METERS)
      .sort((left, right) => left.distanceSquared - right.distanceSquared)
      .slice(0, MATCH_RADAR_MAX_MARKERS);

    visiblePlayers.forEach((entry) => {
      const kind: MatchRadarMarkerKind = options.isTeamMember(entry.player.userId) ? "ally" : "enemy";
      const marker = ensureRadarMarker(entry.player.sessionId, entry.player.nickname, kind);
      const projection = projectToRadarPlane({
        deltaX: entry.deltaX,
        deltaZ: entry.deltaZ,
        forwardX: forward.x,
        forwardZ: forward.z,
        maxRadiusPx: markerRadiusPx,
        radarRangeMeters: MATCH_RADAR_RANGE_METERS
      });

      marker.style.transform = `translate3d(calc(-50% + ${projection.x.toFixed(2)}px), calc(-50% + ${projection.y.toFixed(
        2
      )}px), 0)`;
      visibleIds.add(entry.player.sessionId);
    });

    radarMarkersBySessionId.forEach((marker, sessionId) => {
      if (visibleIds.has(sessionId)) {
        return;
      }

      marker.remove();
      radarMarkersBySessionId.delete(sessionId);
    });

    radarFrameId = window.requestAnimationFrame(renderRadar);
  };

  return {
    update() {
      // Initial kick of the rAF loop; subsequent frames are self-scheduled.
      if (radarFrameId === null) {
        renderRadar();
      }
    },
    dispose() {
      if (radarFrameId !== null) {
        window.cancelAnimationFrame(radarFrameId);
        radarFrameId = null;
      }
      clearRadarMarkers();
    }
  };
}
