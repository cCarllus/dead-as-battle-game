// Responsável por orquestrar entrada na partida global com HUD mínimo, pointer lock e menu ESC de pausa.
import { t, type Locale } from "../../i18n";
import type { MatchPlayerState } from "../../models/match-player.model";
import type { MatchService } from "../../services/match.service";
import type { GameSettings, SettingsService } from "../../services/settings.service";
import type { TeamService } from "../../services/team.service";
import { createGlobalMatchScene, type GlobalMatchSceneHandle } from "../../game/scenes/global-match.scene";
import { bind, qs } from "../components/dom";
import { mountSettingsModal } from "../components/settings-modal";
import template from "../layout/match.html?raw";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

export type MatchScreenActions = {
  locale?: Locale;
  settingsService: SettingsService;
  matchService: MatchService;
  teamService: TeamService;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  onClearSession: () => void;
  onLeaveMatch: () => void;
};

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
  const pointerLockHint = qs<HTMLElement>(screen, '[data-slot="match-pointer-lock-hint"]');

  const pauseMenu = qs<HTMLElement>(screen, '[data-slot="match-menu"]');
  const pauseMenuTitle = qs<HTMLElement>(screen, '[data-slot="match-menu-title"]');
  const pauseMenuExitButton = qs<HTMLButtonElement>(screen, 'button[data-action="leave-match"]');
  const pauseMenuSettingsButton = qs<HTMLButtonElement>(screen, 'button[data-action="open-settings"]');
  const pauseMenuOverlayButton = qs<HTMLButtonElement>(screen, 'button[data-action="match-menu-close"]');

  loadingTitle.textContent = t(locale, "match.loading.title");
  matchTitle.textContent = t(locale, "match.hud.title");
  pauseMenuTitle.textContent = t(locale, "match.menu.title");
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

  let sceneHandle: GlobalMatchSceneHandle | null = null;
  let isPauseMenuOpen = false;
  let isMatchReady = false;
  let hasFatalError = false;
  let wasPointerLocked = false;
  let localSessionId: string | null = null;
  let teamMemberUserIds = resolveTeamMemberUserIds(actions.teamService);

  const isSettingsModalOpen = (): boolean => {
    return screen.classList.contains("is-settings-open");
  };

  const setPlayerCount = (playerCount: number): void => {
    playerCountLabel.textContent = t(locale, "match.hud.players", {
      count: playerCount
    });
  };

  const setPauseMenuVisible = (visible: boolean): void => {
    isPauseMenuOpen = visible;
    pauseMenu.hidden = !visible;
    pauseMenu.setAttribute("aria-hidden", String(!visible));
    pauseMenu.classList.toggle("is-open", visible);
  };

  const updateInputState = (): void => {
    const canReceiveInput = isMatchReady && !hasFatalError && !isPauseMenuOpen && !isSettingsModalOpen();
    sceneHandle?.setInputEnabled(canReceiveInput);

    if (!canReceiveInput) {
      sceneHandle?.exitPointerLock();
    }

    const isPointerLocked = sceneHandle?.isPointerLocked() ?? false;
    pointerLockHint.hidden = isPointerLocked || !canReceiveInput;
    pointerLockHint.textContent = t(locale, "match.hud.pointerLockHint");
  };

  const closePauseMenu = (): void => {
    if (!isPauseMenuOpen) {
      return;
    }

    setPauseMenuVisible(false);
    updateInputState();
  };

  const openPauseMenu = (): void => {
    if ((!isMatchReady && !hasFatalError) || isPauseMenuOpen || isSettingsModalOpen()) {
      return;
    }

    setPauseMenuVisible(true);
    updateInputState();
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
    loadingCard.hidden = false;
    loadingCard.classList.add("is-error");
    loadingText.textContent = message;
    setPauseMenuVisible(true);
    updateInputState();
  };

  const renderMatchPresence = (players: MatchPlayerState[]): void => {
    setPlayerCount(players.length);
    renderPlayerList(playerList, players, localSessionId, teamMemberUserIds, locale);
    sceneHandle?.setTeamMemberUserIds(Array.from(teamMemberUserIds));
    sceneHandle?.setPlayers(players);
  };

  const disposePlayersChanged = actions.matchService.onPlayersChanged((players) => {
    renderMatchPresence(players);
  });

  const disposeTeamUpdated = actions.teamService.onTeamUpdated(() => {
    teamMemberUserIds = resolveTeamMemberUserIds(actions.teamService);
    renderMatchPresence(actions.matchService.getPlayers());
  });

  const disposeMatchError = actions.matchService.onError((error) => {
    showError(error.message);
  });

  const disposePauseMenuExitClick = bind(pauseMenuExitButton, "click", () => {
    actions.onLeaveMatch();
  });

  const disposePauseMenuSettingsClick = bind(pauseMenuSettingsButton, "click", () => {
    settingsModal.open();
    updateInputState();
  });

  const disposePauseMenuOverlayClick = bind(pauseMenuOverlayButton, "click", () => {
    closePauseMenu();
  });

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (isSettingsModalOpen()) {
      return;
    }

    event.preventDefault();

    if (isPauseMenuOpen) {
      closePauseMenu();
      return;
    }

    openPauseMenu();
  };

  const onPointerLockChange = (): void => {
    const isPointerLocked = sceneHandle?.isPointerLocked() ?? false;

    if (wasPointerLocked && !isPointerLocked && (isMatchReady || hasFatalError) && !isPauseMenuOpen && !isSettingsModalOpen()) {
      openPauseMenu();
    }

    wasPointerLocked = isPointerLocked;
    updateInputState();
  };

  const settingsStateObserver = new MutationObserver(() => {
    updateInputState();
  });

  window.addEventListener("keydown", onWindowKeyDown);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  settingsStateObserver.observe(screen, {
    attributes: true,
    attributeFilter: ["class"]
  });

  setPlayerCount(0);
  renderPlayerList(playerList, [], localSessionId, teamMemberUserIds, locale);
  updateInputState();

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
        initialPlayers: actions.matchService.getPlayers()
      });

      const connectedPlayers = actions.matchService.getPlayers();
      sceneHandle.setTeamMemberUserIds(Array.from(teamMemberUserIds));
      renderMatchPresence(connectedPlayers);

      isMatchReady = true;
      hasFatalError = false;
      hideLoading();
      updateInputState();
    } catch (error) {
      const message = error instanceof Error ? error.message : t(locale, "match.error.startFailed");
      showError(message);
      actions.matchService.disconnect();
    }
  })();

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    settingsStateObserver.disconnect();

    disposePauseMenuExitClick();
    disposePauseMenuSettingsClick();
    disposePauseMenuOverlayClick();
    disposePlayersChanged();
    disposeTeamUpdated();
    disposeMatchError();

    settingsModal.dispose();

    sceneHandle?.dispose();
    sceneHandle = null;

    actions.matchService.disconnect();
  };
}
