// Responsável por orquestrar entrada na partida global com HUD completo, pointer lock e menu ESC de pausa.
import { t, type Locale } from "../../i18n";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { MatchService } from "../../services/match.service";
import type { GameSettings, SettingsService } from "../../services/settings.service";
import type { TeamService } from "../../services/team.service";
import type { UserService } from "../../services/user.service";
import { resolveCombatHudState } from "../../services/hud.service";
import { createFullscreenSystem } from "../../game/systems/fullscreen.system";
import { createInputModeSystem } from "../../game/systems/input-mode.system";
import { createPauseMenuSystem } from "../../game/systems/pause-menu.system";
import { createGlobalMatchScene, type GlobalMatchSceneHandle } from "../../game/scenes/global-match.scene";
import { bind, qs } from "../components/dom";
import { mountSettingsModal } from "../components/settings-modal";
import template from "../layout/match.html?raw";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

export type MatchScreenActions = {
  locale?: Locale;
  userService: UserService;
  settingsService: SettingsService;
  matchService: MatchService;
  teamService: TeamService;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  onClearSession: () => void;
  onLeaveMatch: () => void;
};

const FULLSCREEN_NOTICE_TIMEOUT_MS = 3000;
const MIN_EMPTY_BAR_VISUAL_PERCENT = 0;
const STAMINA_PULSE_DURATION_MS = 450;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveTeamMemberUserIds(teamService: TeamService): Set<string> {
  const currentTeam = teamService.getCurrentTeam();
  if (!currentTeam) {
    return new Set<string>();
  }

  return new Set(currentTeam.members.map((member) => member.userId));
}

type ScoreboardKda = {
  kills: number;
  deaths: number;
};

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

function resolvePlayerKda(player: MatchPlayerState, isLocalPlayer: boolean, localKda: ScoreboardKda): ScoreboardKda {
  if (isLocalPlayer) {
    return localKda;
  }

  return {
    kills: normalizeCounter(player.kills),
    deaths: normalizeCounter(player.deaths)
  };
}

function renderPlayerList(
  listNode: HTMLElement,
  players: MatchPlayerState[],
  localSessionId: string | null,
  localKda: ScoreboardKda,
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

    const leftKda = resolvePlayerKda(left, leftIsLocal, localKda);
    const rightKda = resolvePlayerKda(right, rightIsLocal, localKda);
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
    const kda = resolvePlayerKda(player, isLocalPlayer, localKda);
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
  localKda: ScoreboardKda,
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
      const kda = resolvePlayerKda(player, isLocalPlayer, localKda);
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

export function renderMatchScreen(root: HTMLElement, actions: MatchScreenActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const screen = renderScreenTemplate(root, template, '[data-screen="match"]', locale);

  const canvas = qs<HTMLCanvasElement>(screen, '[data-slot="match-canvas"]');
  const loadingCard = qs<HTMLElement>(screen, '[data-slot="match-loading"]');
  const loadingTitle = qs<HTMLElement>(screen, '[data-slot="match-loading-title"]');
  const loadingText = qs<HTMLElement>(screen, '[data-slot="match-loading-text"]');
  const matchTitle = qs<HTMLElement>(screen, '[data-slot="match-title"]');
  const playerCountLabel = qs<HTMLElement>(screen, '[data-slot="match-player-count"]');
  const playerList = qs<HTMLElement>(screen, '[data-slot="match-player-list"]');
  const hudTimer = qs<HTMLElement>(screen, '[data-slot="match-hud-timer"]');
  const hudKills = qs<HTMLElement>(screen, '[data-slot="match-hud-kills"]');
  const hudDeaths = qs<HTMLElement>(screen, '[data-slot="match-hud-deaths"]');
  const hudHealthFill = qs<HTMLElement>(screen, '[data-slot="match-hud-health-fill"]');
  const hudResourceFill = qs<HTMLElement>(screen, '[data-slot="match-hud-resource-fill"]');
  const hudHealthValue = qs<HTMLElement>(screen, '[data-slot="match-hud-health-value"]');
  const hudResourceValue = qs<HTMLElement>(screen, '[data-slot="match-hud-resource-value"]');
  const hudHeroName = qs<HTMLElement>(screen, '[data-slot="match-hud-hero-name"]');
  const hudHeroCard = qs<HTMLImageElement>(screen, '[data-slot="match-hud-hero-card"]');
  const hudUltimateKey = qs<HTMLElement>(screen, '[data-slot="match-hud-ultimate-key"]');
  const hudVitals = qs<HTMLElement>(screen, ".dab-match__vitals");
  const hudSkills = qs<HTMLElement>(screen, '[data-slot="match-skills"]');
  const hudSkillPrimary = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-primary"]');
  const hudSkillSecondary = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-secondary"]');
  const hudSkillUltimate = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-ultimate"]');
  const hudSkillPrimaryIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-primary-icon"]');
  const hudSkillSecondaryIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-secondary-icon"]');
  const hudSkillUltimateIcon = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-ultimate-icon"]');
  const hudSkillPrimaryKey = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-primary-key"]');
  const hudSkillSecondaryKey = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-secondary-key"]');
  const hudSkillUltimateKey = qs<HTMLElement>(screen, '[data-slot="match-skill-slot-ultimate-key"]');
  const hudStaminaRoot = qs<HTMLElement>(screen, '[data-slot="match-hud-stamina"]');
  const hudStaminaFill = qs<HTMLElement>(screen, '[data-slot="match-hud-stamina-fill"]');
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

  loadingTitle.textContent = t(locale, "match.loading.title");
  matchTitle.textContent = t(locale, "match.scoreboard.title");
  scoreboardColPlayer.textContent = t(locale, "match.scoreboard.col.player");
  scoreboardColHero.textContent = t(locale, "match.scoreboard.col.hero");
  scoreboardColKills.textContent = t(locale, "match.scoreboard.col.kills");
  scoreboardColDeaths.textContent = t(locale, "match.scoreboard.col.deaths");
  scoreboardColPing.textContent = t(locale, "match.scoreboard.col.ping");
  pointerLockHint.textContent = t(locale, "match.hud.pointerLockHint");
  fullscreenNotice.textContent = t(locale, "match.hud.fullscreenExited");
  pauseMenuTitle.textContent = t(locale, "match.menu.title");
  pauseMenuResumeButton.textContent = t(locale, "match.menu.resume");
  pauseMenuExitButton.textContent = t(locale, "match.menu.exit");
  pauseMenuSettingsButton.textContent = t(locale, "match.menu.settings");

  const settingsModal = mountSettingsModal({
    locale,
    menu: screen,
    settingsService: actions.settingsService,
    onApplyAudioSettings: actions.onApplyAudioSettings,
    onApplyLocale: actions.onApplyLocale,
    onClearSession: actions.onClearSession
  });
  const fullscreenSystem = createFullscreenSystem();
  const inputModeSystem = createInputModeSystem();

  let sceneHandle: GlobalMatchSceneHandle | null = null;
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
  let localKda: ScoreboardKda = {
    kills: 0,
    deaths: 0
  };
  let localPingLabel = "--ms";
  let previousLocalStaminaPercent = 100;
  let previousSprintBlocked = false;
  let staminaPulseTimeoutId: number | null = null;

  const isSettingsModalOpen = (): boolean => {
    return screen.classList.contains("is-settings-open");
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
    return inputState.gameplayEnabled && isMatchReady && !hasFatalError;
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

  const refreshHudFromUserProfile = (): void => {
    const user = actions.userService.getCurrentUser();
    if (!user) {
      localKda = {
        kills: 0,
        deaths: 0
      };
      hudKills.textContent = "0";
      hudDeaths.textContent = "0";
      return;
    }

    const selectedChampionProgress = user.champions[user.selectedChampionId];
    localKda = {
      kills: normalizeCounter(selectedChampionProgress?.kills ?? 0),
      deaths: normalizeCounter(selectedChampionProgress?.deaths ?? 0)
    };
    hudKills.textContent = String(localKda.kills);
    hudDeaths.textContent = String(localKda.deaths);
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
    const ultimatePercent = setHudBarFill(hudResourceFill, combatHudState.ultimatePercent);
    const isUltimateReady = ultimatePercent >= 100;

    screen.style.setProperty("--dab-hero-skill-theme", combatHudState.skillThemeColor);
    hudSkills.style.setProperty("--dab-hero-skill-theme", combatHudState.skillThemeColor);
    hudUltimateKey.style.setProperty("--dab-hero-skill-theme", combatHudState.skillThemeColor);

    hudHeroName.textContent = combatHudState.heroLabel;
    if (hudHeroCard.src !== combatHudState.heroCardImageUrl) {
      hudHeroCard.src = combatHudState.heroCardImageUrl;
    }
    hudSkillPrimaryIcon.textContent = combatHudState.skills.primary.icon;
    hudSkillSecondaryIcon.textContent = combatHudState.skills.secondary.icon;
    hudSkillUltimateIcon.textContent = combatHudState.skills.ultimate.icon;
    hudSkillPrimaryKey.textContent = combatHudState.skills.primary.key;
    hudSkillSecondaryKey.textContent = combatHudState.skills.secondary.key;
    hudSkillUltimateKey.textContent = combatHudState.skills.ultimate.key;
    hudSkillPrimary.title = combatHudState.skills.primary.name;
    hudSkillSecondary.title = combatHudState.skills.secondary.name;
    hudSkillUltimate.title = combatHudState.skills.ultimate.name;
    hudUltimateKey.textContent = `[${combatHudState.skills.ultimate.key}] ULTIMATE`;

    hudHealthValue.textContent = `${combatHudState.healthCurrent} / ${combatHudState.healthMax}`;
    hudResourceValue.textContent = `${ultimatePercent}%`;

    hudUltimateKey.hidden = !isUltimateReady;
    hudUltimateKey.classList.toggle("is-ready", isUltimateReady);
    hudVitals.classList.toggle("is-ultimate-ready", isUltimateReady);
    setLocalStaminaHud(player);

    if (isUltimateReady) {
      hudResourceValue.textContent = "100%";
      return;
    }

    if (healthPercent <= 0) {
      hudHealthValue.textContent = `0 / ${combatHudState.healthMax}`;
    }
  };

  const updateLocalCombatHud = (players: MatchPlayerState[]): void => {
    if (!localSessionId) {
      setLocalCombatHud(null);
      return;
    }

    const localPlayer = players.find((player) => player.sessionId === localSessionId) ?? null;
    setLocalCombatHud(localPlayer);
  };

  const setFlyUiState = (enabled: boolean): void => {
    isFlyModeEnabled = enabled;
    flyToggleButton.setAttribute("aria-pressed", String(enabled));
  };

  const toggleFlyMode = (): void => {
    if (!sceneHandle || !isMatchReady || hasFatalError || isSettingsModalOpen() || (pauseMenuSystem?.isOpen() ?? false)) {
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
    if ((!isMatchReady && !hasFatalError) || isSettingsModalOpen() || pauseMenuSystem?.isOpen()) {
      return;
    }

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

    const nextPresenceSignature = buildPresenceSignature(players, localSessionId, localKda, localPingLabel);
    if (nextPresenceSignature !== lastPresenceSignature) {
      setPlayerCount(players.length);
      renderPlayerList(playerList, players, localSessionId, localKda, localPingLabel, locale);
      lastPresenceSignature = nextPresenceSignature;
    }
  };

  const disposePlayersChanged = actions.matchService.onPlayersChanged((players) => {
    renderMatchPresence(players);
  });

  const disposePlayerAdded = actions.matchService.onPlayerAdded((player) => {
    sceneHandle?.addPlayer(player);
  });

  const disposePlayerUpdated = actions.matchService.onPlayerUpdated((player) => {
    sceneHandle?.updatePlayer(player);
  });

  const disposePlayerRemoved = actions.matchService.onPlayerRemoved((sessionId) => {
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

  const disposeFlyToggleClick = bind(flyToggleButton, "click", () => {
    toggleFlyMode();
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
    if (event.code === "Tab") {
      if (isTypingOnInputField() || isSettingsModalOpen() || (pauseMenuSystem?.isOpen() ?? false)) {
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
      sceneHandle?.triggerLocalUltimateAnimation();
      actions.matchService.sendUltimateActivate();
      return;
    }

    if (event.key !== "Escape") {
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
    if (event.code !== "Tab") {
      return;
    }

    event.preventDefault();
    setScoreboardRequested(false);
  };

  const onWindowBlur = (): void => {
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
  renderPlayerList(playerList, [], localSessionId, localKda, localPingLabel, locale);
  hudTimer.textContent = formatMatchElapsedTime(elapsedSeconds);
  setLocalCombatHud(null);
  refreshHudFromUserProfile();
  refreshLocalPingLabel();
  inputModeSystem.setSettingsOpen(isSettingsModalOpen());
  applyInputState();
  setFlyUiState(false);
  setScoreboardRequested(false);
  hideFullscreenNotice();

  void (async () => {
    showLoading(t(locale, "match.loading.connecting"));

    try {
      await actions.matchService.connect();
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
        }
      });

      const connectedPlayers = actions.matchService.getPlayers();
      sceneHandle.setTeamMemberUserIds(Array.from(teamMemberUserIds));
      sceneHandle.setPlayers(connectedPlayers);
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
        refreshHudFromUserProfile();
        refreshLocalPingLabel();
        renderMatchPresence(actions.matchService.getPlayers());
      }, 2000);
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
    disposePlayersChanged();
    disposePlayerAdded();
    disposePlayerUpdated();
    disposePlayerRemoved();
    disposeTeamUpdated();
    disposeMatchError();

    pauseMenuSystem?.dispose();
    pauseMenuSystem = null;
    inputModeSystem.dispose();
    fullscreenSystem.dispose();
    hideFullscreenNotice();
    settingsModal.dispose();

    sceneHandle?.dispose();
    sceneHandle = null;
    setFlyUiState(false);

    if (matchTimerIntervalId !== null) {
      window.clearInterval(matchTimerIntervalId);
      matchTimerIntervalId = null;
    }

    if (hudRefreshIntervalId !== null) {
      window.clearInterval(hudRefreshIntervalId);
      hudRefreshIntervalId = null;
    }

    if (staminaPulseTimeoutId !== null) {
      window.clearTimeout(staminaPulseTimeoutId);
      staminaPulseTimeoutId = null;
    }

    actions.matchService.disconnect();
  };
}
