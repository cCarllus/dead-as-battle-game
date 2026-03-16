// Responsável por orquestrar entrada na partida global com HUD completo, pointer lock e menu ESC de pausa.
import { t, type Locale } from "../../i18n";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { ChatMessage } from "../../models/chat-message.model";
import { CHAT_MAX_MESSAGE_LENGTH, type ChatService } from "../../services/chat.service";
import type { MatchService } from "../../services/match.service";
import type { GameSettings, SettingsService } from "../../services/settings.service";
import type { TeamService } from "../../services/team.service";
import type { UserService } from "../../services/user.service";
import type { ChampionId } from "../../models/champion.model";
import { isChampionId } from "../../data/champions.catalog";
import { resolveCombatHudState } from "../../services/hud.service";
import { MATCH_UI_CONFIG } from "../../game/config/ui.config";
import { createFullscreenSystem } from "../../game/systems/fullscreen.system";
import { createInputModeSystem } from "../../game/systems/input-mode.system";
import { createPauseMenuSystem } from "../../game/systems/pause-menu.system";
import { createCombatFeedbackSystem, type CombatFeedbackSystem } from "../../game/systems/combat-feedback.system";
import { createGlobalMatchScene, type GlobalMatchSceneHandle } from "../../game/scenes/global-match.scene";
import { createDamageNumberEffect, type DamageNumberEffect } from "../effects/damage-number.effect";
import { bind, qs } from "../components/dom";
import { setMenuIconContent } from "../components/menu-icon";
import { mountSettingsModal } from "../components/settings-modal";
import template from "../layout/match.html?raw";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

export type MatchScreenActions = {
  locale?: Locale;
  userService: UserService;
  settingsService: SettingsService;
  chatService: ChatService;
  matchService: MatchService;
  teamService: TeamService;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  onClearSession: () => void;
  onLeaveMatch: () => void;
};

const FULLSCREEN_NOTICE_TIMEOUT_MS = MATCH_UI_CONFIG.fullscreenNoticeTimeoutMs;
const MIN_EMPTY_BAR_VISUAL_PERCENT = MATCH_UI_CONFIG.bars.minEmptyBarVisualPercent;
const STAMINA_PULSE_DURATION_MS = MATCH_UI_CONFIG.bars.staminaPulseDurationMs;
const HEALTH_BAR_MAX_HUE = MATCH_UI_CONFIG.bars.healthBarMaxHue;
const MATCH_HUD_FEED_MAX_ITEMS = MATCH_UI_CONFIG.hudFeed.maxItems;
const MATCH_HUD_FEED_TTL_MS = MATCH_UI_CONFIG.hudFeed.ttlMs;
const MATCH_HUD_FEED_FADE_WINDOW_MS = MATCH_UI_CONFIG.hudFeed.fadeWindowMs;
const MATCH_HUD_FEED_HISTORY_SEED_LIMIT = MATCH_UI_CONFIG.hudFeed.historySeedLimit;
const MATCH_KILL_FEED_MAX_ITEMS = MATCH_UI_CONFIG.killFeed.maxItems;
const MATCH_KILL_FEED_TTL_MS = MATCH_UI_CONFIG.killFeed.ttlMs;
const MATCH_KILL_FEED_FADE_WINDOW_MS = MATCH_UI_CONFIG.killFeed.fadeWindowMs;
const MATCH_KILL_FEED_ENTER_MS = MATCH_UI_CONFIG.killFeed.enterMs;
const MATCH_CHAT_BUBBLE_TTL_MS = MATCH_UI_CONFIG.chatBubble.ttlMs;
const MATCH_CHAT_BUBBLE_FADE_WINDOW_MS = MATCH_UI_CONFIG.chatBubble.fadeWindowMs;
const MATCH_CHAT_BUBBLE_MAX_CHARS = MATCH_UI_CONFIG.chatBubble.maxChars;
const MATCH_RADAR_RANGE_METERS = MATCH_UI_CONFIG.radar.rangeMeters;
const MATCH_RADAR_MAX_MARKERS = MATCH_UI_CONFIG.radar.maxMarkers;
const MATCH_RADAR_MARKER_EDGE_PADDING_PX = MATCH_UI_CONFIG.radar.markerEdgePaddingPx;
const MATCH_RADAR_COMPASS_RADIUS_RATIO = MATCH_UI_CONFIG.radar.compassRadiusRatio;
const MATCH_OVERHEAD_BAR_RANGE_METERS = MATCH_UI_CONFIG.overheadBars.rangeMeters;

type MatchHudFeedEntry = {
  id: string;
  kind: "server" | "chat";
  nickname: string | null;
  text: string;
  createdAt: number;
  expiresAt: number;
};

type MatchSpeechBubbleEntry = {
  sessionId: string;
  text: string;
  createdAt: number;
  expiresAt: number;
  element: HTMLDivElement;
  textNode: HTMLSpanElement;
};

type MatchKillFeedEntry = {
  id: string;
  killerSessionId: string;
  victimSessionId: string;
  killerName: string;
  victimName: string;
  timestamp: number;
  createdAt: number;
  expiresAt: number;
};

type MatchRadarMarkerKind = "ally" | "enemy";

type MatchOverheadBarKind = "ally" | "enemy";

type MatchOverheadBarEntry = {
  sessionId: string;
  element: HTMLDivElement;
  levelNode: HTMLSpanElement;
  nameNode: HTMLSpanElement;
  healthFillNode: HTMLSpanElement;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveHealthBarFillGradient(healthPercent: number): { gradient: string; shadow: string } {
  const safePercent = Math.max(0, Math.min(100, healthPercent));
  const hue = (safePercent / 100) * HEALTH_BAR_MAX_HUE;
  const accentHue = Math.max(0, hue - 14);
  const highlightHue = Math.min(HEALTH_BAR_MAX_HUE, hue + 8);

  return {
    gradient: `linear-gradient(90deg, hsl(${accentHue} 88% 46%), hsl(${hue} 86% 52%), hsl(${highlightHue} 82% 66%))`,
    shadow: `0 0 18px hsla(${hue} 92% 56% / 0.42)`
  };
}

function resolveTeamMemberUserIds(teamService: TeamService): Set<string> {
  const currentTeam = teamService.getCurrentTeam();
  if (!currentTeam) {
    return new Set<string>();
  }

  return new Set(currentTeam.members.map((member) => member.userId));
}

function normalizeCounter(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeHeroLabel(heroId: string): string {
  const normalized = heroId.trim();
  if (!normalized) {
    return "DEFAULT";
  }

  return normalized.replace(/_/g, " ").toUpperCase();
}

function resolvePingLabel(): string {
  const navigatorWithConnection = navigator as Navigator & {
    connection?: {
      rtt?: number;
    };
  };
  const pingValue = navigatorWithConnection.connection?.rtt;
  if (typeof pingValue === "number" && Number.isFinite(pingValue) && pingValue > 0) {
    return `${Math.round(pingValue)}ms`;
  }

  return "--ms";
}

function resolvePlayerKda(player: MatchPlayerState): { kills: number; deaths: number } {
  return {
    kills: normalizeCounter(player.kills),
    deaths: normalizeCounter(player.deaths)
  };
}

function renderPlayerList(
  listNode: HTMLElement,
  players: MatchPlayerState[],
  localSessionId: string | null,
  localPingLabel: string,
  locale: Locale
): void {
  listNode.replaceChildren();

  if (players.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "dab-match__scoreboard-empty";
    emptyItem.textContent = t(locale, "match.scoreboard.empty");
    listNode.appendChild(emptyItem);
    return;
  }

  const sortedPlayers = [...players].sort((left, right) => {
    const leftIsLocal = localSessionId !== null && left.sessionId === localSessionId;
    const rightIsLocal = localSessionId !== null && right.sessionId === localSessionId;
    if (leftIsLocal !== rightIsLocal) {
      return leftIsLocal ? -1 : 1;
    }

    const leftKda = resolvePlayerKda(left);
    const rightKda = resolvePlayerKda(right);
    if (leftKda.kills !== rightKda.kills) {
      return rightKda.kills - leftKda.kills;
    }

    if (leftKda.deaths !== rightKda.deaths) {
      return leftKda.deaths - rightKda.deaths;
    }

    if (left.joinedAt !== right.joinedAt) {
      return left.joinedAt - right.joinedAt;
    }

    return left.nickname.localeCompare(right.nickname);
  });

  sortedPlayers.forEach((player) => {
    const isLocalPlayer = localSessionId !== null && player.sessionId === localSessionId;
    const kda = resolvePlayerKda(player);
    const pingLabel = isLocalPlayer ? localPingLabel : "--ms";

    const row = document.createElement("li");
    row.className = "dab-match__scoreboard-row";
    if (isLocalPlayer) {
      row.classList.add("is-local");
    }

    const playerCell = document.createElement("span");
    playerCell.className = "dab-match__scoreboard-cell is-player";
    playerCell.textContent = player.nickname;
    if (isLocalPlayer) {
      const localBadge = document.createElement("small");
      localBadge.className = "dab-match__score-badge is-local";
      localBadge.textContent = t(locale, "match.hud.you");
      playerCell.appendChild(localBadge);
    }

    const heroCell = document.createElement("span");
    heroCell.className = "dab-match__scoreboard-cell is-hero";
    heroCell.textContent = normalizeHeroLabel(player.heroId);

    const killsCell = document.createElement("span");
    killsCell.className = "dab-match__scoreboard-cell is-kills";
    killsCell.textContent = String(kda.kills);

    const deathsCell = document.createElement("span");
    deathsCell.className = "dab-match__scoreboard-cell is-deaths";
    deathsCell.textContent = String(kda.deaths);

    const pingCell = document.createElement("span");
    pingCell.className = "dab-match__scoreboard-cell is-ping";
    pingCell.textContent = pingLabel;

    row.append(playerCell, heroCell, killsCell, deathsCell, pingCell);
    listNode.appendChild(row);
  });
}

function buildPresenceSignature(
  players: MatchPlayerState[],
  localSessionId: string | null,
  localPingLabel: string
): string {
  const sortedPlayers = [...players].sort((left, right) => {
    if (left.joinedAt !== right.joinedAt) {
      return left.joinedAt - right.joinedAt;
    }

    return left.nickname.localeCompare(right.nickname);
  });

  return sortedPlayers
    .map((player) => {
      const isLocalPlayer = localSessionId !== null && player.sessionId === localSessionId;
      const kda = resolvePlayerKda(player);
      const ping = isLocalPlayer ? localPingLabel : "--ms";
      return `${player.sessionId}:${player.nickname}:${player.heroId}:${player.joinedAt}:${kda.kills}:${kda.deaths}:${ping}:${isLocalPlayer ? "1" : "0"}`;
    })
    .join("|");
}

function formatMatchElapsedTime(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

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

export function renderMatchScreen(root: HTMLElement, actions: MatchScreenActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const screen = renderScreenTemplate(root, template, '[data-screen="match"]', locale);
  const viewport = qs<HTMLElement>(screen, ".dab-match__viewport");

  const canvas = qs<HTMLCanvasElement>(screen, '[data-slot="match-canvas"]');
  const loadingCard = qs<HTMLElement>(screen, '[data-slot="match-loading"]');
  const loadingTitle = qs<HTMLElement>(screen, '[data-slot="match-loading-title"]');
  const loadingText = qs<HTMLElement>(screen, '[data-slot="match-loading-text"]');
  const matchTitle = qs<HTMLElement>(screen, '[data-slot="match-title"]');
  const playerCountLabel = qs<HTMLElement>(screen, '[data-slot="match-player-count"]');
  const playerList = qs<HTMLElement>(screen, '[data-slot="match-player-list"]');
  const hudTimer = qs<HTMLElement>(screen, '[data-slot="match-hud-timer"]');
  const hudKillsLabel = qs<HTMLElement>(screen, '[data-slot="match-hud-kills-label"]');
  const hudDeathsLabel = qs<HTMLElement>(screen, '[data-slot="match-hud-deaths-label"]');
  const hudKills = qs<HTMLElement>(screen, '[data-slot="match-hud-kills"]');
  const hudDeaths = qs<HTMLElement>(screen, '[data-slot="match-hud-deaths"]');
  const hudKillLog = qs<HTMLElement>(screen, '[data-slot="match-kill-log"]');
  const hudRadarDisc = qs<HTMLElement>(screen, '[data-slot="match-radar-disc"]');
  const hudRadarMarkers = qs<HTMLElement>(screen, '[data-slot="match-radar-markers"]');
  const hudRadarNorth = qs<HTMLElement>(screen, '[data-slot="match-radar-direction-north"]');
  const hudRadarEast = qs<HTMLElement>(screen, '[data-slot="match-radar-direction-east"]');
  const hudRadarSouth = qs<HTMLElement>(screen, '[data-slot="match-radar-direction-south"]');
  const hudRadarWest = qs<HTMLElement>(screen, '[data-slot="match-radar-direction-west"]');
  const hudOverheadBarsLayer = qs<HTMLElement>(screen, '[data-slot="match-overhead-bars-layer"]');
  const hudHealthFill = qs<HTMLElement>(screen, '[data-slot="match-hud-health-fill"]');
  const hudResourceFill = qs<HTMLElement>(screen, '[data-slot="match-hud-resource-fill"]');
  const hudHealthValue = qs<HTMLElement>(screen, '[data-slot="match-hud-health-value"]');
  const hudResourceValue = qs<HTMLElement>(screen, '[data-slot="match-hud-resource-value"]');
  const hudHeroName = qs<HTMLElement>(screen, '[data-slot="match-hud-hero-name"]');
  const hudHeroCard = qs<HTMLImageElement>(screen, '[data-slot="match-hud-hero-card"]');
  const hudLevelBadge = qs<HTMLElement>(screen, '[data-slot="match-hud-level-badge"]');
  const hudUltimateKey = qs<HTMLElement>(screen, '[data-slot="match-hud-ultimate-key"]');
  const hudVitals = qs<HTMLElement>(screen, ".dab-match__vitals");
  const hudSkills = qs<HTMLElement>(screen, '[data-slot="match-skills"]');
  const hudSkillPrimary = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-primary"]');
  const hudSkillSecondary = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-secondary"]');
  const hudSkillUltimate = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-ultimate"]');
  const hudSkillPrimaryIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-primary-icon"]');
  const hudSkillSecondaryIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-secondary-icon"]');
  const hudSkillTertiaryIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-tertiary-icon"]');
  const hudSkillUtilityIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-utility-icon"]');
  const hudSkillFlyIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-fly-icon"]');
  const hudSkillUltimateIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-ultimate-icon"]');
  const hudSkillPrimaryKey = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-primary-key"]');
  const hudSkillSecondaryKey = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-secondary-key"]');
  const hudSkillUltimateKey = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-ultimate-key"]');
  const hudAttackControlIcon = qs<HTMLElement>(screen, '[data-slot="match-control-icon-attack"]');
  const hudHeavyControlIcon = qs<HTMLElement>(screen, '[data-slot="match-control-icon-heavy"]');
  const controlsHeading = qs<HTMLElement>(screen, '[data-slot="match-controls-heading"]');
  const controlCopyAttack = qs<HTMLElement>(screen, '[data-slot="match-control-copy-attack"]');
  const controlCopyHeavy = qs<HTMLElement>(screen, '[data-slot="match-control-copy-heavy"]');
  const controlCopySprint = qs<HTMLElement>(screen, '[data-slot="match-control-copy-sprint"]');
  const controlCopyJump = qs<HTMLElement>(screen, '[data-slot="match-control-copy-jump"]');
  const controlCopyRoll = qs<HTMLElement>(screen, '[data-slot="match-control-copy-roll"]');
  const controlCopyFly = qs<HTMLElement>(screen, '[data-slot="match-control-copy-fly"]');
  const controlKeySprint = qs<HTMLElement>(screen, '[data-slot="match-control-key-sprint"]');
  const controlKeyJump = qs<HTMLElement>(screen, '[data-slot="match-control-key-jump"]');
  const hudStaminaRoot = qs<HTMLElement>(screen, '[data-slot="match-hud-stamina"]');
  const hudStaminaFill = qs<HTMLElement>(screen, '[data-slot="match-hud-stamina-fill"]');
  const hudChatFeed = qs<HTMLElement>(screen, '[data-slot="match-chat-feed"]');
  const hudSpeechLayer = qs<HTMLElement>(screen, '[data-slot="match-speech-layer"]');
  const chatComposer = qs<HTMLFormElement>(screen, '[data-slot="match-chat-composer"]');
  const chatInput = qs<HTMLInputElement>(screen, '[data-slot="match-chat-input"]');
  const pointerLockHint = qs<HTMLElement>(screen, '[data-slot="match-pointer-lock-hint"]');
  const fullscreenNotice = qs<HTMLElement>(screen, '[data-slot="match-fullscreen-notice"]');
  const scoreboardColPlayer = qs<HTMLElement>(screen, '[data-slot="match-scoreboard-col-player"]');
  const scoreboardColHero = qs<HTMLElement>(screen, '[data-slot="match-scoreboard-col-hero"]');
  const scoreboardColKills = qs<HTMLElement>(screen, '[data-slot="match-scoreboard-col-kills"]');
  const scoreboardColDeaths = qs<HTMLElement>(screen, '[data-slot="match-scoreboard-col-deaths"]');
  const scoreboardColPing = qs<HTMLElement>(screen, '[data-slot="match-scoreboard-col-ping"]');

  const pauseMenu = qs<HTMLElement>(screen, '[data-slot="match-menu"]');
  const pauseMenuTitle = qs<HTMLElement>(screen, '[data-slot="match-menu-title"]');
  const pauseMenuResumeButton = qs<HTMLButtonElement>(screen, 'button[data-action="resume-match"]');
  const pauseMenuExitButton = qs<HTMLButtonElement>(screen, 'button[data-action="leave-match"]');
  const pauseMenuSettingsButton = qs<HTMLButtonElement>(screen, 'button[data-action="open-settings"]');
  const pauseMenuOverlayButton = qs<HTMLButtonElement>(screen, 'button[data-action="match-menu-close"]');
  const flyToggleButton = qs<HTMLButtonElement>(screen, 'button[data-action="toggle-fly"]');
  const scoreboardCard = qs<HTMLElement>(screen, '[data-slot="match-scoreboard"]');
  const deathModal = qs<HTMLElement>(screen, '[data-slot="match-death-modal"]');
  const deathModalTitle = qs<HTMLElement>(screen, '[data-slot="match-death-title"]');
  const deathModalMessage = qs<HTMLElement>(screen, '[data-slot="match-death-message"]');
  const deathModalBackLobbyButton = qs<HTMLButtonElement>(screen, 'button[data-action="match-death-back-lobby"]');
  const deathModalRespawnButton = qs<HTMLButtonElement>(screen, 'button[data-action="match-death-respawn"]');

  loadingTitle.textContent = t(locale, "match.loading.title");
  matchTitle.textContent = t(locale, "match.scoreboard.title");
  scoreboardColPlayer.textContent = t(locale, "match.scoreboard.col.player");
  scoreboardColHero.textContent = t(locale, "match.scoreboard.col.hero");
  scoreboardColKills.textContent = t(locale, "match.scoreboard.col.kills");
  scoreboardColDeaths.textContent = t(locale, "match.scoreboard.col.deaths");
  scoreboardColPing.textContent = t(locale, "match.scoreboard.col.ping");
  hudKillsLabel.textContent = t(locale, "match.hud.kills");
  hudDeathsLabel.textContent = t(locale, "match.hud.deaths");
  pointerLockHint.textContent = t(locale, "match.hud.pointerLockHint");
  fullscreenNotice.textContent = t(locale, "match.hud.fullscreenExited");
  pauseMenuTitle.textContent = t(locale, "match.menu.title");
  pauseMenuResumeButton.textContent = t(locale, "match.menu.resume");
  pauseMenuExitButton.textContent = t(locale, "match.menu.exit");
  pauseMenuSettingsButton.textContent = t(locale, "match.menu.settings");
  controlsHeading.textContent = t(locale, "match.controls.heading");
  controlCopyAttack.textContent = t(locale, "match.controls.attack");
  controlCopyHeavy.textContent = t(locale, "match.controls.heavy");
  controlCopySprint.textContent = t(locale, "match.controls.sprint");
  controlCopyJump.textContent = t(locale, "match.controls.jump");
  controlCopyRoll.textContent = t(locale, "match.controls.roll");
  controlCopyFly.textContent = t(locale, "match.controls.flyMode");
  controlKeySprint.textContent = t(locale, "match.controls.key.shift");
  controlKeyJump.textContent = t(locale, "match.controls.key.space");
  deathModalTitle.textContent = locale === "pt-BR" ? "Você morreu" : "You Died";
  deathModalMessage.textContent =
    locale === "pt-BR"
      ? "Escolha voltar ao lobby ou renascer para continuar a batalha."
      : "Choose to return to the lobby or respawn and continue fighting.";
  deathModalBackLobbyButton.textContent = locale === "pt-BR" ? "Voltar ao lobby" : "Back to lobby";
  deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascer" : "Respawn";

  setMenuIconContent(hudSkillPrimaryIcon, "hudAbilityPrimary", { className: "dab-match__hud-svg-icon" });
  setMenuIconContent(hudSkillSecondaryIcon, "hudAbilitySecondary", { className: "dab-match__hud-svg-icon" });
  setMenuIconContent(hudSkillTertiaryIcon, "hudAbilityTertiary", { className: "dab-match__hud-svg-icon" });
  setMenuIconContent(hudSkillUtilityIcon, "hudAbilityUtility", { className: "dab-match__hud-svg-icon" });
  setMenuIconContent(hudSkillFlyIcon, "hudAbilityUtility", { className: "dab-match__hud-svg-icon" });
  setMenuIconContent(hudSkillUltimateIcon, "hudUltimate", { className: "dab-match__hud-svg-icon" });
  setMenuIconContent(hudAttackControlIcon, "hudControlMouse", { className: "dab-match__control-svg-icon" });
  setMenuIconContent(hudHeavyControlIcon, "hudControlMouse", { className: "dab-match__control-svg-icon" });

  const settingsModal = mountSettingsModal({
    locale,
    menu: screen,
    settingsService: actions.settingsService,
    onApplyAudioSettings: actions.onApplyAudioSettings,
    onApplySettings: (settings) => {
      sceneHandle?.applyViewSettings({
        cameraFovPercent: settings.cameraFovPercent,
        renderDistanceViewPercent: settings.renderDistanceViewPercent
      });
    },
    onApplyLocale: actions.onApplyLocale,
    onClearSession: actions.onClearSession
  });
  const fullscreenSystem = createFullscreenSystem();
  const inputModeSystem = createInputModeSystem();
  let sceneHandle: GlobalMatchSceneHandle | null = null;
  const effectsLayer = document.createElement("div");
  effectsLayer.dataset.slot = "match-effects-layer";
  viewport.appendChild(effectsLayer);
  const damageNumberEffect: DamageNumberEffect = createDamageNumberEffect({
    container: effectsLayer
  });
  const combatFeedbackSystem: CombatFeedbackSystem = createCombatFeedbackSystem({
    matchService: actions.matchService,
    damageNumbers: damageNumberEffect,
    resolveScreenPosition: (sessionId) => {
      return sceneHandle?.getPlayerScreenPosition(sessionId) ?? null;
    }
  });

  let pauseMenuSystem: ReturnType<typeof createPauseMenuSystem> | null = null;
  let isMatchReady = false;
  let hasFatalError = false;
  let wasPointerLocked = false;
  let wasFullscreen = fullscreenSystem.isFullscreen();
  let localSessionId: string | null = null;
  let teamMemberUserIds = resolveTeamMemberUserIds(actions.teamService);
  let lastPresenceSignature = "";
  let elapsedSeconds = 0;
  let matchTimerIntervalId: number | null = null;
  let hudRefreshIntervalId: number | null = null;
  let fullscreenNoticeTimeoutId: number | null = null;
  let disposeScenePointerLockChanged: (() => void) | null = null;
  let isFlyModeEnabled = false;
  let isScoreboardRequested = false;
  let localPingLabel = "--ms";
  let previousLocalStaminaPercent = 100;
  let previousSprintBlocked = false;
  let staminaPulseTimeoutId: number | null = null;
  let deathModalOpen = false;
  let respawnRequestPending = false;
  let hudFeedIntervalId: number | null = null;
  let didSeedChatHistory = false;
  let hudFeedEntries: MatchHudFeedEntry[] = [];
  let killFeedEntries: MatchKillFeedEntry[] = [];
  let chatComposerOpen = false;
  let shouldResumePointerLockAfterChat = false;
  let speechBubbleFrameId: number | null = null;
  let overheadBarsFrameId: number | null = null;
  let radarFrameId: number | null = null;
  const speechBubblesBySessionId = new Map<string, MatchSpeechBubbleEntry>();
  const overheadBarsBySessionId = new Map<string, MatchOverheadBarEntry>();
  const radarMarkersBySessionId = new Map<string, HTMLSpanElement>();

  chatInput.maxLength = CHAT_MAX_MESSAGE_LENGTH;
  chatInput.placeholder = locale === "pt-BR" ? "Digite e pressione Enter" : "Type and press Enter";
  hudLevelBadge.textContent = t(locale, "match.hud.levelBadge", { level: 1 });

  const resolveLocalChampionLevel = (player: MatchPlayerState | null): number => {
    const user = actions.userService.getCurrentUser();
    if (!user) {
      return 1;
    }

    const championId = player && isChampionId(player.heroId) ? player.heroId : user.selectedChampionId;
    return user.champions[championId]?.level ?? 1;
  };

  const truncateChatBubbleText = (text: string): string => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= MATCH_CHAT_BUBBLE_MAX_CHARS) {
      return normalized;
    }

    return `${normalized.slice(0, MATCH_CHAT_BUBBLE_MAX_CHARS - 1).trimEnd()}…`;
  };

  const resolveSessionIdForUserId = (userId: string): string | null => {
    const player = actions.matchService.getPlayers().find((candidate) => candidate.userId === userId) ?? null;
    return player?.sessionId ?? null;
  };

  const removeSpeechBubble = (sessionId: string): void => {
    const bubble = speechBubblesBySessionId.get(sessionId);
    if (!bubble) {
      return;
    }

    bubble.element.remove();
    speechBubblesBySessionId.delete(sessionId);
  };

  const removeOverheadBar = (sessionId: string): void => {
    const entry = overheadBarsBySessionId.get(sessionId);
    if (!entry) {
      return;
    }

    entry.element.remove();
    overheadBarsBySessionId.delete(sessionId);
  };

  const isChatFocused = (): boolean => {
    return inputModeSystem.getState().chatFocused;
  };

  const setChatFocused = (focused: boolean): void => {
    inputModeSystem.setChatFocused(focused);
  };

  const renderSpeechBubbles = (): void => {
    const now = Date.now();

    speechBubblesBySessionId.forEach((bubble, sessionId) => {
      if (bubble.expiresAt <= now) {
        removeSpeechBubble(sessionId);
        return;
      }

      const playerScreenPosition = sceneHandle?.getPlayerScreenPosition(sessionId) ?? null;
      if (!playerScreenPosition) {
        bubble.element.hidden = true;
        return;
      }

      const fadeProgress =
        bubble.expiresAt - now > MATCH_CHAT_BUBBLE_FADE_WINDOW_MS
          ? 1
          : Math.max(0, (bubble.expiresAt - now) / MATCH_CHAT_BUBBLE_FADE_WINDOW_MS);

      bubble.element.hidden = false;
      bubble.element.style.setProperty("--dab-speech-x", `${playerScreenPosition.x}px`);
      bubble.element.style.setProperty("--dab-speech-y", `${playerScreenPosition.y - 74}px`);
      bubble.element.style.setProperty("--dab-speech-opacity", fadeProgress.toFixed(3));
    });

    speechBubbleFrameId = window.requestAnimationFrame(renderSpeechBubbles);
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
    hudOverheadBarsLayer.appendChild(element);

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
    const players = actions.matchService.getPlayers();
    const handle = sceneHandle;
    if (!localSessionId || !handle) {
      overheadBarsBySessionId.forEach((entry) => {
        entry.element.classList.remove("is-visible");
      });
      overheadBarsFrameId = window.requestAnimationFrame(renderOverheadBars);
      return;
    }

    const localPlayer = players.find((player) => player.sessionId === localSessionId) ?? null;
    const localPosition =
      localPlayer ? handle.getPlayerWorldPosition(localPlayer.sessionId) ?? { x: localPlayer.x, y: localPlayer.y, z: localPlayer.z } : null;

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

      const worldPosition = handle.getPlayerWorldPosition(player.sessionId) ?? {
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
      const screenPosition = handle.getPlayerNameplateScreenPosition(player.sessionId);
      const isVisible = !!screenPosition && distanceSquared <= MATCH_OVERHEAD_BAR_RANGE_METERS * MATCH_OVERHEAD_BAR_RANGE_METERS;
      const kind: MatchOverheadBarKind = teamMemberUserIds.has(player.userId) ? "ally" : "enemy";
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

  const resolveFallbackRadarForward = (): { x: number; z: number } => {
    const localPlayer = localSessionId
      ? actions.matchService.getPlayers().find((player) => player.sessionId === localSessionId) ?? null
      : null;
    if (!localPlayer) {
      return { x: 0, z: 1 };
    }

    return {
      x: Math.sin(localPlayer.rotationY),
      z: Math.cos(localPlayer.rotationY)
    };
  };

  const resolveRadarPlayerPosition = (player: MatchPlayerState): { x: number; y: number; z: number } => {
    return sceneHandle?.getPlayerWorldPosition(player.sessionId) ?? {
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
    hudRadarMarkers.appendChild(marker);
    radarMarkersBySessionId.set(sessionId, marker);
    return marker;
  };

  const renderRadar = (): void => {
    const discRadiusPx = hudRadarDisc.clientWidth * 0.5;
    const markerRadiusPx = Math.max(0, discRadiusPx - MATCH_RADAR_MARKER_EDGE_PADDING_PX);
    const compassRadiusPx = Math.max(18, discRadiusPx * MATCH_RADAR_COMPASS_RADIUS_RATIO);
    const forward = normalizeForward(sceneHandle?.getCameraGroundForward() ?? resolveFallbackRadarForward());

    positionRadarDirection(hudRadarNorth, { x: 0, z: 1 }, forward, compassRadiusPx);
    positionRadarDirection(hudRadarEast, { x: 1, z: 0 }, forward, compassRadiusPx);
    positionRadarDirection(hudRadarSouth, { x: 0, z: -1 }, forward, compassRadiusPx);
    positionRadarDirection(hudRadarWest, { x: -1, z: 0 }, forward, compassRadiusPx);

    if (!localSessionId || markerRadiusPx <= 0) {
      clearRadarMarkers();
      radarFrameId = window.requestAnimationFrame(renderRadar);
      return;
    }

    const players = actions.matchService.getPlayers();
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
      const kind: MatchRadarMarkerKind = teamMemberUserIds.has(entry.player.userId) ? "ally" : "enemy";
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

  const upsertSpeechBubble = (sessionId: string, text: string): void => {
    const now = Date.now();
    const normalizedText = truncateChatBubbleText(text);
    let bubble = speechBubblesBySessionId.get(sessionId);
    if (!bubble) {
      const element = document.createElement("div");
      element.className = "dab-match__speech-bubble";

      const textNode = document.createElement("span");
      textNode.className = "dab-match__speech-text";

      const tail = document.createElement("span");
      tail.className = "dab-match__speech-tail";

      element.append(textNode, tail);
      hudSpeechLayer.appendChild(element);

      bubble = {
        sessionId,
        text: normalizedText,
        createdAt: now,
        expiresAt: now + MATCH_CHAT_BUBBLE_TTL_MS,
        element,
        textNode
      };
      speechBubblesBySessionId.set(sessionId, bubble);
    }

    bubble.text = normalizedText;
    bubble.createdAt = now;
    bubble.expiresAt = now + MATCH_CHAT_BUBBLE_TTL_MS;
    bubble.textNode.textContent = normalizedText;
  };

  const closeChatComposer = (resumePointerLock: boolean): void => {
    if (!chatComposerOpen) {
      return;
    }

    chatComposerOpen = false;
    screen.classList.remove("is-chat-open");
    setChatFocused(false);
    chatInput.blur();

    if (resumePointerLock && shouldResumePointerLockAfterChat && hasGameplayInputPermission()) {
      sceneHandle?.requestPointerLock();
    }

    shouldResumePointerLockAfterChat = false;
    applyInputState();
  };

  const openChatComposer = (): void => {
    if (chatComposerOpen || !isMatchReady || hasFatalError || deathModalOpen || isSettingsModalOpen()) {
      return;
    }

    shouldResumePointerLockAfterChat = sceneHandle?.isPointerLocked() ?? false;
    chatComposerOpen = true;
    screen.classList.add("is-chat-open");
    setChatFocused(true);
    sceneHandle?.exitPointerLock();
    applyInputState();

    window.setTimeout(() => {
      chatInput.focus();
      chatInput.select();
    }, 0);
  };

  const pruneHudFeedEntries = (now = Date.now()): void => {
    hudFeedEntries = hudFeedEntries.filter((entry) => entry.expiresAt > now);
    if (hudFeedEntries.length > MATCH_HUD_FEED_MAX_ITEMS) {
      hudFeedEntries = hudFeedEntries.slice(-MATCH_HUD_FEED_MAX_ITEMS);
    }
  };

  const pruneKillFeedEntries = (now = Date.now()): void => {
    killFeedEntries = killFeedEntries.filter((entry) => entry.expiresAt > now).slice(0, MATCH_KILL_FEED_MAX_ITEMS);
  };

  const renderHudFeed = (): void => {
    const now = Date.now();
    pruneHudFeedEntries(now);
    hudChatFeed.replaceChildren();

    hudFeedEntries.forEach((entry) => {
      const ageMs = Math.max(0, now - entry.createdAt);
      const timeRemainingMs = Math.max(0, entry.expiresAt - now);
      const fadeProgress =
        timeRemainingMs >= MATCH_HUD_FEED_FADE_WINDOW_MS
          ? 1
          : Math.max(0, timeRemainingMs / MATCH_HUD_FEED_FADE_WINDOW_MS);
      const stackProgress = 1 - Math.min(0.34, (hudFeedEntries.length - 1 - hudFeedEntries.indexOf(entry)) * 0.06);
      const opacity = Math.max(0, Math.min(1, fadeProgress * stackProgress));
      const offsetY = Math.min(10, ageMs / 1400);

      const line = document.createElement("div");
      line.className = `dab-match__chat-line ${entry.kind === "server" ? "is-server" : "is-chat"}`;
      line.style.setProperty("--dab-chat-feed-opacity", opacity.toFixed(3));
      line.style.setProperty("--dab-chat-feed-offset", `${offsetY}px`);

      if (entry.kind === "server") {
        line.textContent = entry.text;
      } else {
        const nickname = document.createElement("span");
        nickname.className = "dab-match__chat-nickname";
        nickname.textContent = `[${entry.nickname ?? "Player"}]:`;

        const message = document.createElement("span");
        message.className = "dab-match__chat-message";
        message.textContent = entry.text;

        line.append(nickname, " ", message);
      }

      hudChatFeed.appendChild(line);
    });
  };

  const pushHudFeedEntry = (entry: Omit<MatchHudFeedEntry, "createdAt" | "expiresAt">): void => {
    const now = Date.now();
    hudFeedEntries = [
      ...hudFeedEntries,
      {
        ...entry,
        createdAt: now,
        expiresAt: now + MATCH_HUD_FEED_TTL_MS
      }
    ];
    pruneHudFeedEntries(now);
    renderHudFeed();
  };

  const appendHudChatMessage = (message: Pick<ChatMessage, "id" | "nickname" | "text">): void => {
    const normalizedText = message.text.trim();
    if (!normalizedText) {
      return;
    }

    pushHudFeedEntry({
      id: `chat:${message.id}`,
      kind: "chat",
      nickname: message.nickname.trim() || "Player",
      text: normalizedText
    });
  };

  const renderKillFeed = (): void => {
    const now = Date.now();
    pruneKillFeedEntries(now);
    hudKillLog.replaceChildren();

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
      icon.textContent = "⊗";

      const victim = document.createElement("span");
      victim.className = `dab-match__kill-feed-player ${
        entry.victimSessionId === localSessionId ? "is-local" : "is-enemy"
      }`;
      victim.textContent = entry.victimName;

      item.append(killer, icon, victim);
      hudKillLog.appendChild(item);
    });
  };

  const pushKillFeedEntry = (payload: {
    killerSessionId: string;
    victimSessionId: string;
    killerName: string;
    victimName: string;
    timestamp: number;
  }): void => {
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
  };

  const isSettingsModalOpen = (): boolean => {
    return screen.classList.contains("is-settings-open");
  };

  const setDeathModalOpen = (open: boolean): void => {
    if (deathModalOpen === open) {
      return;
    }

    deathModalOpen = open;
    deathModal.hidden = !open;
    deathModal.classList.toggle("is-open", open);
    deathModal.setAttribute("aria-hidden", String(!open));

    if (open) {
      closeChatComposer(false);
      sceneHandle?.exitPointerLock();
      closePauseMenu(false);
      setScoreboardRequested(false);
    }

    applyInputState();
  };

  const hideFullscreenNotice = (): void => {
    fullscreenNotice.hidden = true;

    if (fullscreenNoticeTimeoutId !== null) {
      window.clearTimeout(fullscreenNoticeTimeoutId);
      fullscreenNoticeTimeoutId = null;
    }
  };

  const showFullscreenNotice = (): void => {
    fullscreenNotice.hidden = false;

    if (fullscreenNoticeTimeoutId !== null) {
      window.clearTimeout(fullscreenNoticeTimeoutId);
    }

    fullscreenNoticeTimeoutId = window.setTimeout(() => {
      fullscreenNotice.hidden = true;
      fullscreenNoticeTimeoutId = null;
    }, FULLSCREEN_NOTICE_TIMEOUT_MS);
  };

  const hasGameplayInputPermission = (): boolean => {
    const inputState = inputModeSystem.getState();
    return inputState.gameplayEnabled && isMatchReady && !hasFatalError && !deathModalOpen && !chatComposerOpen;
  };

  const renderScoreboardVisibility = (): void => {
    const isVisible =
      isScoreboardRequested &&
      hasGameplayInputPermission() &&
      !isSettingsModalOpen() &&
      !(pauseMenuSystem?.isOpen() ?? false);
    screen.classList.toggle("is-scoreboard-visible", isVisible);
    scoreboardCard.setAttribute("aria-hidden", String(!isVisible));
  };

  const setScoreboardRequested = (nextRequested: boolean): void => {
    isScoreboardRequested = nextRequested;
    renderScoreboardVisibility();
  };

  const renderPointerLockHint = (): void => {
    const canReceiveInput = hasGameplayInputPermission();
    const isPointerLocked = sceneHandle?.isPointerLocked() ?? false;
    pointerLockHint.hidden = isPointerLocked || !canReceiveInput;
  };

  const setPlayerCount = (playerCount: number): void => {
    playerCountLabel.textContent = t(locale, "match.hud.players", {
      count: playerCount
    });
  };

  const resolveLocalChampionIdForProfile = (): ChampionId | null => {
    if (localSessionId) {
      const localMatchPlayer =
        actions.matchService.getPlayers().find((player) => player.sessionId === localSessionId) ?? null;
      if (localMatchPlayer && isChampionId(localMatchPlayer.heroId)) {
        return localMatchPlayer.heroId;
      }
    }

    const user = actions.userService.getCurrentUser();
    if (!user) {
      return null;
    }

    return user.selectedChampionId;
  };

  const applyLocalChampionKdaDelta = (killsDelta: number, deathsDelta: number): void => {
    if (killsDelta === 0 && deathsDelta === 0) {
      return;
    }

    const championId = resolveLocalChampionIdForProfile();
    if (!championId) {
      return;
    }

    actions.userService.updateCurrentUser((user) => {
      const championProgress = user.champions[championId];
      if (!championProgress) {
        return user;
      }

      return {
        ...user,
        champions: {
          ...user.champions,
          [championId]: {
            ...championProgress,
            kills: normalizeCounter(championProgress.kills + killsDelta),
            deaths: normalizeCounter(championProgress.deaths + deathsDelta)
          }
        }
      };
    });
  };

  const refreshLocalPingLabel = (): void => {
    localPingLabel = resolvePingLabel();
  };

  const setHudBarFill = (fillElement: HTMLElement, percent: number): number => {
    const clampedPercent = clampPercent(percent);
    const visualPercent = clampedPercent <= 0 ? MIN_EMPTY_BAR_VISUAL_PERCENT : clampedPercent;
    fillElement.style.width = `${visualPercent}%`;
    fillElement.classList.toggle("is-empty", clampedPercent <= 0);
    return clampedPercent;
  };

  const queueStaminaPulse = (pulseClassName: "is-depleted-pulse" | "is-recovered-pulse"): void => {
    if (staminaPulseTimeoutId !== null) {
      window.clearTimeout(staminaPulseTimeoutId);
      staminaPulseTimeoutId = null;
    }

    hudStaminaRoot.classList.remove("is-depleted-pulse", "is-recovered-pulse");
    void hudStaminaRoot.offsetWidth;
    hudStaminaRoot.classList.add(pulseClassName);

    staminaPulseTimeoutId = window.setTimeout(() => {
      hudStaminaRoot.classList.remove("is-depleted-pulse", "is-recovered-pulse");
      staminaPulseTimeoutId = null;
    }, STAMINA_PULSE_DURATION_MS);
  };

  const setLocalStaminaHud = (player: MatchPlayerState | null): void => {
    if (!player) {
      hudStaminaRoot.classList.remove("is-visible", "is-depleted-pulse", "is-recovered-pulse");
      hudStaminaFill.style.width = "100%";
      hudStaminaFill.classList.remove("is-mid", "is-low");
      setHudBarFill(hudResourceFill, 100);
      hudResourceValue.textContent = "100%";
      previousLocalStaminaPercent = 100;
      previousSprintBlocked = false;
      return;
    }

    const maxStamina = Math.max(1, player.maxStamina);
    const currentStamina = Math.max(0, Math.min(player.currentStamina, maxStamina));
    const staminaPercent = clampPercent((currentStamina / maxStamina) * 100);
    hudStaminaFill.style.width = `${staminaPercent}%`;
    hudStaminaFill.classList.toggle("is-mid", staminaPercent <= 50 && staminaPercent > 25);
    hudStaminaFill.classList.toggle("is-low", staminaPercent <= 25);
    setHudBarFill(hudResourceFill, staminaPercent);
    hudResourceValue.textContent = `${staminaPercent}%`;

    const shouldShowStaminaHud = player.isSprinting || staminaPercent < 100;
    hudStaminaRoot.classList.toggle("is-visible", shouldShowStaminaHud);

    if (previousLocalStaminaPercent > 0 && staminaPercent <= 0) {
      queueStaminaPulse("is-depleted-pulse");
    }

    if (previousSprintBlocked && !player.sprintBlocked) {
      queueStaminaPulse("is-recovered-pulse");
    }

    previousLocalStaminaPercent = staminaPercent;
    previousSprintBlocked = player.sprintBlocked;
  };

  const setLocalCombatHud = (player: MatchPlayerState | null): void => {
    const combatHudState = resolveCombatHudState(player);
    const healthPercent = setHudBarFill(hudHealthFill, combatHudState.healthPercent);
    const healthBarVisual = resolveHealthBarFillGradient(healthPercent);
    hudHealthFill.style.setProperty("--dab-health-bar-fill", healthBarVisual.gradient);
    hudHealthFill.style.setProperty("--dab-health-bar-shadow", healthBarVisual.shadow);
    const ultimatePercent = clampPercent(combatHudState.ultimatePercent);
    const isUltimateReady = ultimatePercent >= 100;

    screen.style.setProperty("--dab-hero-skill-theme", combatHudState.skillThemeColor);
    hudSkills.style.setProperty("--dab-hero-skill-theme", combatHudState.skillThemeColor);
    hudUltimateKey.style.setProperty("--dab-hero-skill-theme", combatHudState.skillThemeColor);

    hudHeroName.textContent = combatHudState.heroLabel;
    hudLevelBadge.textContent = t(locale, "match.hud.levelBadge", {
      level: resolveLocalChampionLevel(player)
    });
    if (hudHeroCard.src !== combatHudState.heroCardImageUrl) {
      hudHeroCard.src = combatHudState.heroCardImageUrl;
    }
    hudSkillPrimaryKey.textContent = combatHudState.skills.primary.key;
    hudSkillSecondaryKey.textContent = combatHudState.skills.secondary.key;
    hudSkillUltimateKey.textContent = combatHudState.skills.ultimate.key;
    hudSkillPrimary.title = combatHudState.skills.primary.name;
    hudSkillSecondary.title = combatHudState.skills.secondary.name;
    hudSkillUltimate.title = combatHudState.skills.ultimate.name;
    hudSkillUltimate.style.setProperty("--dab-ultimate-charge", `${ultimatePercent}%`);
    hudUltimateKey.textContent = `[${combatHudState.skills.ultimate.key}] ULTIMATE`;

    hudHealthValue.textContent = `${combatHudState.healthCurrent} / ${combatHudState.healthMax}`;
    hudResourceValue.textContent = `${ultimatePercent}%`;

    hudUltimateKey.hidden = true;
    hudUltimateKey.classList.toggle("is-ready", isUltimateReady);
    hudVitals.classList.toggle("is-ultimate-ready", isUltimateReady);
    hudSkillUltimate.classList.toggle("is-ready", isUltimateReady);
    setLocalStaminaHud(player);

    if (isUltimateReady) {
      return;
    }

    if (healthPercent <= 0) {
      hudHealthValue.textContent = `0 / ${combatHudState.healthMax}`;
    }
  };

  const updateLocalCombatHud = (players: MatchPlayerState[]): void => {
    if (!localSessionId) {
      hudKills.textContent = "0";
      hudDeaths.textContent = "0";
      setLocalCombatHud(null);
      respawnRequestPending = false;
      deathModalRespawnButton.disabled = false;
      deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascer" : "Respawn";
      setDeathModalOpen(false);
      return;
    }

    const localPlayer = players.find((player) => player.sessionId === localSessionId) ?? null;
    if (!localPlayer) {
      hudKills.textContent = "0";
      hudDeaths.textContent = "0";
    } else {
      hudKills.textContent = String(normalizeCounter(localPlayer.kills));
      hudDeaths.textContent = String(normalizeCounter(localPlayer.deaths));
    }
    setLocalCombatHud(localPlayer);

    const isDead = !!localPlayer && !localPlayer.isAlive;
    if (isDead) {
      setDeathModalOpen(true);
      return;
    }

    if (respawnRequestPending) {
      respawnRequestPending = false;
      deathModalRespawnButton.disabled = false;
      deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascer" : "Respawn";
    }
    setDeathModalOpen(false);
  };

  const setFlyUiState = (enabled: boolean): void => {
    isFlyModeEnabled = enabled;
    flyToggleButton.setAttribute("aria-pressed", String(enabled));
  };

  const toggleFlyMode = (): void => {
    if (
      !sceneHandle ||
      !isMatchReady ||
      hasFatalError ||
      deathModalOpen ||
      isSettingsModalOpen() ||
      (pauseMenuSystem?.isOpen() ?? false)
    ) {
      return;
    }

    const nextEnabled = sceneHandle.toggleFlyMode();
    setFlyUiState(nextEnabled);
  };

  const applyInputState = (): void => {
    const canReceiveInput = hasGameplayInputPermission();
    sceneHandle?.setInputEnabled(canReceiveInput);

    if (!canReceiveInput) {
      sceneHandle?.exitPointerLock();
    }

    renderPointerLockHint();
    renderScoreboardVisibility();
  };

  const closePauseMenu = (resumePointerLock: boolean): void => {
    if (!pauseMenuSystem?.isOpen()) {
      return;
    }

    pauseMenuSystem.close();
    inputModeSystem.setPauseMenuOpen(false);

    if (resumePointerLock && hasGameplayInputPermission()) {
      sceneHandle?.requestPointerLock();
    }

    renderScoreboardVisibility();
  };

  const openPauseMenu = (): void => {
    if (
      (!isMatchReady && !hasFatalError) ||
      deathModalOpen ||
      isSettingsModalOpen() ||
      pauseMenuSystem?.isOpen()
    ) {
      return;
    }

    closeChatComposer(false);
    pauseMenuSystem?.open();
    inputModeSystem.setPauseMenuOpen(true);
    renderScoreboardVisibility();
  };

  const showLoading = (message: string): void => {
    loadingCard.hidden = false;
    loadingCard.classList.remove("is-error");
    loadingText.textContent = message;
  };

  const hideLoading = (): void => {
    loadingCard.hidden = true;
    loadingCard.classList.remove("is-error");
  };

  const showError = (message: string): void => {
    hasFatalError = true;
    setScoreboardRequested(false);
    inputModeSystem.setGameplayAvailable(false);
    loadingCard.hidden = false;
    loadingCard.classList.add("is-error");
    loadingText.textContent = message;
    openPauseMenu();
  };

  const renderMatchPresence = (players: MatchPlayerState[]): void => {
    updateLocalCombatHud(players);

    const nextPresenceSignature = buildPresenceSignature(players, localSessionId, localPingLabel);
    if (nextPresenceSignature !== lastPresenceSignature) {
      setPlayerCount(players.length);
      renderPlayerList(playerList, players, localSessionId, localPingLabel, locale);
      lastPresenceSignature = nextPresenceSignature;
    }
  };

  const disposePlayersChanged = actions.matchService.onPlayersChanged((players) => {
    renderMatchPresence(players);
  });

  const disposePlayerAdded = actions.matchService.onPlayerAdded((player) => {
    pushHudFeedEntry({
      id: `join:${player.sessionId}:${player.joinedAt}`,
      kind: "server",
      nickname: null,
      text: `${player.nickname} se conectou a sala`
    });
    sceneHandle?.addPlayer(player);
  });

  const disposePlayerUpdated = actions.matchService.onPlayerUpdated((player) => {
    sceneHandle?.updatePlayer(player);
  });

  const disposePlayerRemoved = actions.matchService.onPlayerRemoved((sessionId) => {
    removeSpeechBubble(sessionId);
    sceneHandle?.removePlayer(sessionId);
  });

  const disposeTeamUpdated = actions.teamService.onTeamUpdated(() => {
    teamMemberUserIds = resolveTeamMemberUserIds(actions.teamService);
    sceneHandle?.setTeamMemberUserIds(Array.from(teamMemberUserIds));
    renderMatchPresence(actions.matchService.getPlayers());
  });

  const disposeMatchError = actions.matchService.onError((error) => {
    showError(error.message);
  });
  const disposeCombatKill = actions.matchService.onCombatKill((payload) => {
    if (!localSessionId) {
      pushKillFeedEntry({
        killerSessionId: payload.killerSessionId,
        victimSessionId: payload.victimSessionId,
        killerName: payload.killerName,
        victimName: payload.victimName,
        timestamp: payload.timestamp
      });
      renderMatchPresence(actions.matchService.getPlayers());
      return;
    }

    const killsDelta = payload.killerSessionId === localSessionId ? 1 : 0;
    const deathsDelta = payload.victimSessionId === localSessionId ? 1 : 0;
    applyLocalChampionKdaDelta(killsDelta, deathsDelta);
    pushKillFeedEntry({
      killerSessionId: payload.killerSessionId,
      victimSessionId: payload.victimSessionId,
      killerName: payload.killerName,
      victimName: payload.victimName,
      timestamp: payload.timestamp
    });
    renderMatchPresence(actions.matchService.getPlayers());
  });
  const disposeCombatUltimate = actions.matchService.onCombatUltimate((payload) => {
    sceneHandle?.triggerPlayerUltimateEffect({
      sessionId: payload.sessionId,
      characterId: payload.characterId,
      durationMs: payload.durationMs
    });
  });
  const disposeChatHistory = actions.chatService.onHistory((history) => {
    if (didSeedChatHistory || history.length === 0) {
      return;
    }

    didSeedChatHistory = true;
    history.slice(-MATCH_HUD_FEED_HISTORY_SEED_LIMIT).forEach((message) => {
      appendHudChatMessage(message);
    });
  });
  const disposeChatMessage = actions.chatService.onMessage((message) => {
    appendHudChatMessage(message);
    const sessionId = resolveSessionIdForUserId(message.userId);
    if (sessionId) {
      upsertSpeechBubble(sessionId, message.text);
    }
  });

  const disposeFlyToggleClick = bind(flyToggleButton, "click", () => {
    toggleFlyMode();
  });
  const disposeChatComposerSubmit = bind(chatComposer, "submit", (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) {
      closeChatComposer(true);
      return;
    }

    actions.chatService.sendMessage(text);
    chatInput.value = "";
    closeChatComposer(true);
  });
  const disposeChatInputFocus = bind(chatInput, "focus", () => {
    setChatFocused(true);
    applyInputState();
  });
  const disposeChatInputBlur = bind(chatInput, "blur", (event) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && chatComposer.contains(nextTarget)) {
      setChatFocused(true);
      return;
    }

    if (chatComposerOpen) {
      closeChatComposer(false);
      return;
    }

    setChatFocused(false);
    applyInputState();
  });
  const disposeChatInputKeyDown = bind(chatInput, "keydown", (event) => {
    event.stopPropagation();

    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeChatComposer(true);
  });
  const disposeChatInputKeyUp = bind(chatInput, "keyup", (event) => {
    event.stopPropagation();
  });
  const disposeDeathBackLobbyClick = bind(deathModalBackLobbyButton, "click", () => {
    actions.onLeaveMatch();
  });
  const disposeDeathRespawnClick = bind(deathModalRespawnButton, "click", () => {
    if (respawnRequestPending) {
      return;
    }

    if (!localSessionId) {
      return;
    }

    const localPlayer = actions.matchService.getPlayers().find((player) => player.sessionId === localSessionId) ?? null;
    if (!localPlayer || localPlayer.isAlive) {
      return;
    }

    respawnRequestPending = true;
    deathModalRespawnButton.disabled = true;
    deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascendo..." : "Respawning...";
    actions.matchService.sendRespawnRequest();
  });

  pauseMenuSystem = createPauseMenuSystem({
    menu: pauseMenu,
    overlayButton: pauseMenuOverlayButton,
    resumeButton: pauseMenuResumeButton,
    settingsButton: pauseMenuSettingsButton,
    exitButton: pauseMenuExitButton,
    onResume: () => {
      closePauseMenu(true);
    },
    onOpenSettings: () => {
      closePauseMenu(false);
      settingsModal.open();
      inputModeSystem.setSettingsOpen(true);
    },
    onExitMatch: () => {
      actions.onLeaveMatch();
    }
  });

  const onScenePointerLockChanged = (isPointerLocked: boolean): void => {
    if (
      wasPointerLocked &&
      !isPointerLocked &&
      (isMatchReady || hasFatalError) &&
      !deathModalOpen &&
      !chatComposerOpen &&
      !isChatFocused() &&
      !isSettingsModalOpen() &&
      !(pauseMenuSystem?.isOpen() ?? false)
    ) {
      openPauseMenu();
    }

    wasPointerLocked = isPointerLocked;
    renderPointerLockHint();
  };

  const isTypingOnInputField = (): boolean => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return false;
    }

    const tagName = activeElement.tagName;
    return (
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      activeElement.isContentEditable
    );
  };

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (isChatFocused()) {
      return;
    }

    if (event.key === "Enter") {
      if (isTypingOnInputField()) {
        return;
      }

      if (!hasGameplayInputPermission()) {
        return;
      }

      event.preventDefault();
      openChatComposer();
      return;
    }

    if (event.code === "Tab") {
      if (
        isTypingOnInputField() ||
        deathModalOpen ||
        isSettingsModalOpen() ||
        (pauseMenuSystem?.isOpen() ?? false)
      ) {
        return;
      }

      event.preventDefault();
      setScoreboardRequested(true);
      return;
    }

    if (event.code === "KeyF") {
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      toggleFlyMode();
      return;
    }

    if (event.code === "KeyG") {
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      if (!hasGameplayInputPermission() || isTypingOnInputField()) {
        return;
      }

      const localPlayer = localSessionId
        ? actions.matchService.getPlayers().find((player) => player.sessionId === localSessionId) ?? null
        : null;
      const canActivateUltimate =
        !!localPlayer &&
        localPlayer.isAlive &&
        localPlayer.isUltimateReady &&
        localPlayer.ultimateCharge >= localPlayer.ultimateMax;
      if (!canActivateUltimate) {
        return;
      }

      event.preventDefault();
      actions.matchService.sendUltimateActivate();
      return;
    }

    if (event.key !== "Escape") {
      return;
    }

    if (chatComposerOpen) {
      event.preventDefault();
      closeChatComposer(true);
      return;
    }

    if (isSettingsModalOpen()) {
      return;
    }

    event.preventDefault();

    const isPointerLocked = sceneHandle?.isPointerLocked() ?? false;
    if (isPointerLocked) {
      sceneHandle?.exitPointerLock();
      openPauseMenu();
      return;
    }

    if (pauseMenuSystem?.isOpen()) {
      closePauseMenu(true);
      return;
    }

    openPauseMenu();
  };

  const onWindowKeyUp = (event: KeyboardEvent): void => {
    if (isChatFocused()) {
      return;
    }

    if (event.code !== "Tab") {
      return;
    }

    event.preventDefault();
    setScoreboardRequested(false);
  };

  const onWindowBlur = (): void => {
    setChatFocused(false);
    setScoreboardRequested(false);
  };

  const settingsStateObserver = new MutationObserver(() => {
    inputModeSystem.setSettingsOpen(isSettingsModalOpen());
  });

  const disposeInputModeChanged = inputModeSystem.onStateChanged(() => {
    applyInputState();
  });

  const disposeFullscreenChanged = fullscreenSystem.onChange((isFullscreen) => {
    const prefersFullscreen = actions.settingsService.load().fullscreen;

    if (wasFullscreen && !isFullscreen && prefersFullscreen) {
      showFullscreenNotice();
    } else if (isFullscreen) {
      hideFullscreenNotice();
    }

    wasFullscreen = isFullscreen;
  });

  window.addEventListener("keydown", onWindowKeyDown);
  window.addEventListener("keyup", onWindowKeyUp);
  window.addEventListener("blur", onWindowBlur);
  settingsStateObserver.observe(screen, {
    attributes: true,
    attributeFilter: ["class"]
  });

  setPlayerCount(0);
  renderPlayerList(playerList, [], localSessionId, localPingLabel, locale);
  hudTimer.textContent = formatMatchElapsedTime(elapsedSeconds);
  setLocalCombatHud(null);
  hudKills.textContent = "0";
  hudDeaths.textContent = "0";
  refreshLocalPingLabel();
  inputModeSystem.setSettingsOpen(isSettingsModalOpen());
  applyInputState();
  setFlyUiState(false);
  setScoreboardRequested(false);
  setDeathModalOpen(false);
  hideFullscreenNotice();
  renderHudFeed();
  renderKillFeed();
  renderSpeechBubbles();
  renderOverheadBars();
  renderRadar();

  void (async () => {
    showLoading(t(locale, "match.loading.connecting"));

    try {
      await Promise.all([
        actions.matchService.connect(),
        actions.chatService.connect().catch(() => {
          // Match HUD chat is optional. Keep the match flow alive if chat is unavailable.
        })
      ]);
      localSessionId = actions.matchService.getLocalSessionId();
      if (!localSessionId) {
        throw new Error(t(locale, "match.error.invalidSession"));
      }

      showLoading(t(locale, "match.loading.map"));
      sceneHandle = await createGlobalMatchScene({
        canvas,
        localSessionId,
        initialPlayers: actions.matchService.getPlayers(),
        onLocalPlayerMoved: (position) => {
          actions.matchService.sendLocalMovement(position);
        },
        onLocalSprintIntentChanged: (intent) => {
          actions.matchService.sendSprintIntent(intent);
        },
        onLocalAttackRequested: () => {
          actions.matchService.sendAttackStart();
        },
        onLocalBlockStartRequested: () => {
          actions.matchService.sendBlockStart();
        },
        onLocalBlockEndRequested: () => {
          actions.matchService.sendBlockEnd();
        }
      });

      const connectedPlayers = actions.matchService.getPlayers();
      sceneHandle.setTeamMemberUserIds(Array.from(teamMemberUserIds));
      sceneHandle.setPlayers(connectedPlayers);
      sceneHandle.applyViewSettings({
        cameraFovPercent: actions.settingsService.load().cameraFovPercent,
        renderDistanceViewPercent: actions.settingsService.load().renderDistanceViewPercent
      });
      disposeScenePointerLockChanged = sceneHandle.onPointerLockChanged(onScenePointerLockChanged);
      wasPointerLocked = sceneHandle.isPointerLocked();
      setFlyUiState(sceneHandle.isFlyModeEnabled());
      renderMatchPresence(connectedPlayers);

      isMatchReady = true;
      hasFatalError = false;
      inputModeSystem.setGameplayAvailable(true);
      hideLoading();
      applyInputState();

      matchTimerIntervalId = window.setInterval(() => {
        elapsedSeconds += 1;
        hudTimer.textContent = formatMatchElapsedTime(elapsedSeconds);
      }, 1000);

      hudRefreshIntervalId = window.setInterval(() => {
        refreshLocalPingLabel();
        renderMatchPresence(actions.matchService.getPlayers());
      }, 2000);

      hudFeedIntervalId = window.setInterval(() => {
        renderHudFeed();
        renderKillFeed();
      }, 250);
    } catch (error) {
      const message = error instanceof Error ? error.message : t(locale, "match.error.startFailed");
      showError(message);
      actions.matchService.disconnect();
    }
  })();

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
    window.removeEventListener("keyup", onWindowKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    settingsStateObserver.disconnect();
    disposeInputModeChanged();
    disposeFullscreenChanged();
    disposeScenePointerLockChanged?.();
    disposeScenePointerLockChanged = null;

    disposeFlyToggleClick();
    disposeChatComposerSubmit();
    disposeChatInputFocus();
    disposeChatInputBlur();
    disposeChatInputKeyDown();
    disposeChatInputKeyUp();
    disposeDeathBackLobbyClick();
    disposeDeathRespawnClick();
    disposePlayersChanged();
    disposePlayerAdded();
    disposePlayerUpdated();
    disposePlayerRemoved();
    disposeTeamUpdated();
    disposeMatchError();
    disposeCombatKill();
    disposeCombatUltimate();
    disposeChatHistory();
    disposeChatMessage();

    pauseMenuSystem?.dispose();
    pauseMenuSystem = null;
    inputModeSystem.dispose();
    fullscreenSystem.dispose();
    hideFullscreenNotice();
    settingsModal.dispose();

    sceneHandle?.dispose();
    sceneHandle = null;
    setFlyUiState(false);
    closeChatComposer(false);

    if (matchTimerIntervalId !== null) {
      window.clearInterval(matchTimerIntervalId);
      matchTimerIntervalId = null;
    }

    if (hudRefreshIntervalId !== null) {
      window.clearInterval(hudRefreshIntervalId);
      hudRefreshIntervalId = null;
    }

    if (hudFeedIntervalId !== null) {
      window.clearInterval(hudFeedIntervalId);
      hudFeedIntervalId = null;
    }

    if (staminaPulseTimeoutId !== null) {
      window.clearTimeout(staminaPulseTimeoutId);
      staminaPulseTimeoutId = null;
    }

    if (speechBubbleFrameId !== null) {
      window.cancelAnimationFrame(speechBubbleFrameId);
      speechBubbleFrameId = null;
    }

    if (overheadBarsFrameId !== null) {
      window.cancelAnimationFrame(overheadBarsFrameId);
      overheadBarsFrameId = null;
    }

    if (radarFrameId !== null) {
      window.cancelAnimationFrame(radarFrameId);
      radarFrameId = null;
    }

    speechBubblesBySessionId.forEach((bubble) => {
      bubble.element.remove();
    });
    speechBubblesBySessionId.clear();
    clearOverheadBars();
    clearRadarMarkers();

    combatFeedbackSystem.dispose();
    damageNumberEffect.dispose();
    effectsLayer.remove();

    actions.matchService.disconnect();
  };
}
