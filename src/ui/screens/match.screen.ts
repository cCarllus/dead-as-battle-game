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

type NavigatorConnectionLike = {
  rtt?: number;
};

type NavigatorWithConnection = Navigator & {
  connection?: NavigatorConnectionLike;
};

const FULLSCREEN_NOTICE_TIMEOUT_MS = 3000;
const MIN_EMPTY_BAR_VISUAL_PERCENT = 0;

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

function renderPlayerList(
  listNode: HTMLElement,
  players: MatchPlayerState[],
  localSessionId: string | null,
  teamMemberUserIds: ReadonlySet<string>,
  locale: Locale
): void {
  listNode.replaceChildren();

  if (players.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "-";
    listNode.appendChild(emptyItem);
    return;
  }

  const sortedPlayers = [...players].sort((left, right) => {
    if (left.joinedAt !== right.joinedAt) {
      return left.joinedAt - right.joinedAt;
    }

    return left.nickname.localeCompare(right.nickname);
  });

  sortedPlayers.forEach((player) => {
    const isLocalPlayer = localSessionId !== null && player.sessionId === localSessionId;
    const isTeammate = !isLocalPlayer && teamMemberUserIds.has(player.userId);

    const item = document.createElement("li");
    item.className = "dab-match__player-item";

    if (isLocalPlayer) {
      item.classList.add("is-local");
    }

    if (isTeammate) {
      item.classList.add("is-teammate");
    }

    const playerName = document.createElement("span");
    playerName.className = "dab-match__player-name";
    playerName.textContent = player.nickname;
    item.appendChild(playerName);

    if (isTeammate) {
      const teammateIcon = document.createElement("span");
      teammateIcon.className = "dab-match__player-icon";
      teammateIcon.setAttribute("aria-hidden", "true");
      teammateIcon.textContent = "●";
      item.insertBefore(teammateIcon, playerName);

      const teammateBadge = document.createElement("small");
      teammateBadge.className = "dab-match__player-badge";
      teammateBadge.textContent = t(locale, "match.hud.ally");
      item.appendChild(teammateBadge);
    }

    listNode.appendChild(item);
  });
}

function buildPresenceSignature(
  players: MatchPlayerState[],
  localSessionId: string | null,
  teamMemberUserIds: ReadonlySet<string>
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
      const isTeammate = !isLocalPlayer && teamMemberUserIds.has(player.userId);
      return `${player.sessionId}:${player.nickname}:${player.joinedAt}:${isLocalPlayer ? "1" : "0"}:${isTeammate ? "1" : "0"}`;
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

function resolvePingLabel(): string {
  const navigatorWithConnection = navigator as NavigatorWithConnection;
  const pingValue = navigatorWithConnection.connection?.rtt;
  if (typeof pingValue === "number" && Number.isFinite(pingValue) && pingValue > 0) {
    return `${Math.round(pingValue)}ms`;
  }

  return "24ms";
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
  const hudCoins = qs<HTMLElement>(screen, '[data-slot="match-hud-coins"]');
  const hudPing = qs<HTMLElement>(screen, '[data-slot="match-hud-ping"]');
  const hudHealthFill = qs<HTMLElement>(screen, '[data-slot="match-hud-health-fill"]');
  const hudResourceFill = qs<HTMLElement>(screen, '[data-slot="match-hud-resource-fill"]');
  const hudHealthValue = qs<HTMLElement>(screen, '[data-slot="match-hud-health-value"]');
  const hudResourceValue = qs<HTMLElement>(screen, '[data-slot="match-hud-resource-value"]');
  const hudHeroName = qs<HTMLElement>(screen, '[data-slot="match-hud-hero-name"]');
  const hudHeroCard = qs<HTMLImageElement>(screen, '[data-slot="match-hud-hero-card"]');
  const hudUltimateKey = qs<HTMLElement>(screen, '[data-slot="match-hud-ultimate-key"]');
  const hudUltimateReady = qs<HTMLElement>(screen, '[data-slot="match-hud-ultimate-ready"]');
  const hudVitals = qs<HTMLElement>(screen, ".dab-match__vitals");
  const pointerLockHint = qs<HTMLElement>(screen, '[data-slot="match-pointer-lock-hint"]');
  const fullscreenNotice = qs<HTMLElement>(screen, '[data-slot="match-fullscreen-notice"]');

  const pauseMenu = qs<HTMLElement>(screen, '[data-slot="match-menu"]');
  const pauseMenuTitle = qs<HTMLElement>(screen, '[data-slot="match-menu-title"]');
  const pauseMenuResumeButton = qs<HTMLButtonElement>(screen, 'button[data-action="resume-match"]');
  const pauseMenuExitButton = qs<HTMLButtonElement>(screen, 'button[data-action="leave-match"]');
  const pauseMenuSettingsButton = qs<HTMLButtonElement>(screen, 'button[data-action="open-settings"]');
  const pauseMenuOverlayButton = qs<HTMLButtonElement>(screen, 'button[data-action="match-menu-close"]');
  const flyToggleButton = qs<HTMLButtonElement>(screen, 'button[data-action="toggle-fly"]');

  loadingTitle.textContent = t(locale, "match.loading.title");
  matchTitle.textContent = t(locale, "match.hud.title");
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
      hudCoins.textContent = "0";
      hudKills.textContent = "0";
      hudDeaths.textContent = "0";
      return;
    }

    const selectedChampionProgress = user.champions[user.selectedChampionId];
    hudCoins.textContent = String(user.coins);
    hudKills.textContent = String(selectedChampionProgress?.kills ?? 0);
    hudDeaths.textContent = String(selectedChampionProgress?.deaths ?? 0);
  };

  const refreshPingHud = (): void => {
    hudPing.textContent = resolvePingLabel();
  };

  const setHudBarFill = (fillElement: HTMLElement, percent: number): number => {
    const clampedPercent = clampPercent(percent);
    const visualPercent = clampedPercent <= 0 ? MIN_EMPTY_BAR_VISUAL_PERCENT : clampedPercent;
    fillElement.style.width = `${visualPercent}%`;
    fillElement.classList.toggle("is-empty", clampedPercent <= 0);
    return clampedPercent;
  };

  const setLocalCombatHud = (player: MatchPlayerState | null): void => {
    const combatHudState = resolveCombatHudState(player);
    const healthPercent = setHudBarFill(hudHealthFill, combatHudState.healthPercent);
    const ultimatePercent = setHudBarFill(hudResourceFill, combatHudState.ultimatePercent);

    hudHeroName.textContent = combatHudState.heroLabel;
    if (hudHeroCard.src !== combatHudState.heroCardImageUrl) {
      hudHeroCard.src = combatHudState.heroCardImageUrl;
    }
    hudHealthValue.textContent = `${combatHudState.healthCurrent} / ${combatHudState.healthMax}`;
    hudResourceValue.textContent = `${ultimatePercent}%`;

    hudUltimateReady.hidden = !combatHudState.isUltimateReady;
    hudUltimateKey.classList.toggle("is-ready", combatHudState.isUltimateReady);
    hudVitals.classList.toggle("is-ultimate-ready", combatHudState.isUltimateReady);

    if (combatHudState.isUltimateReady) {
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
  };

  const openPauseMenu = (): void => {
    if ((!isMatchReady && !hasFatalError) || isSettingsModalOpen() || pauseMenuSystem?.isOpen()) {
      return;
    }

    pauseMenuSystem?.open();
    inputModeSystem.setPauseMenuOpen(true);
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
    inputModeSystem.setGameplayAvailable(false);
    loadingCard.hidden = false;
    loadingCard.classList.add("is-error");
    loadingText.textContent = message;
    openPauseMenu();
  };

  const renderMatchPresence = (players: MatchPlayerState[]): void => {
    updateLocalCombatHud(players);

    const nextPresenceSignature = buildPresenceSignature(players, localSessionId, teamMemberUserIds);
    if (nextPresenceSignature !== lastPresenceSignature) {
      setPlayerCount(players.length);
      renderPlayerList(playerList, players, localSessionId, teamMemberUserIds, locale);
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

      event.preventDefault();
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
  settingsStateObserver.observe(screen, {
    attributes: true,
    attributeFilter: ["class"]
  });

  setPlayerCount(0);
  renderPlayerList(playerList, [], localSessionId, teamMemberUserIds, locale);
  hudTimer.textContent = formatMatchElapsedTime(elapsedSeconds);
  setLocalCombatHud(null);
  refreshHudFromUserProfile();
  refreshPingHud();
  inputModeSystem.setSettingsOpen(isSettingsModalOpen());
  applyInputState();
  setFlyUiState(false);
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
        refreshPingHud();
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : t(locale, "match.error.startFailed");
      showError(message);
      actions.matchService.disconnect();
    }
  })();

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
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

    actions.matchService.disconnect();
  };
}
