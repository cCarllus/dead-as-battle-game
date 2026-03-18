// Responsável por compor renderização e interações da tela Home.
import template from "../layout/home.html?raw";
import { t, type Locale } from "../../i18n";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../navigation/menu.model";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";
import { bindHomeEvents } from "./home.events";
import { renderHomeView, type HomeSelectedChampionStats } from "./home.view";
import type { MenuActionId } from "./home.model";
import { mountSettingsModal } from "../components/settings-modal";
import { mountExitConfirmModal } from "../components/exit-confirm-modal";
import type { GameSettings, SettingsService } from "../../services/settings.service";
import type { ChatService } from "../../services/chat.service";
import { mountChatPanel } from "../components/chat-panel";
import type { TeamService, TeamToast } from "../../services/team.service";
import { mountTeamPanel } from "../components/team-panel";
import { mountTeamInvitePopup } from "../components/team-invite-popup";
import { createSpotifyLobbyPlayer, destroySpotifyLobbyPlayer } from "../components/spotify-player";
import { qs } from "../components/dom";
import type { NotificationService } from "../../services/notification.service";
import type { RewardService } from "../../services/reward.service";
import type { UserService } from "../../services/user.service";
import type { PlayerProgressService } from "../../services/player-progress.service";
import { mountHomeHud } from "../components/home-hud";
import type { MatchPresenceService } from "../../services/match-presence.service";
import type { ChampionPreviewAnimation } from "../../models/champion.model";

export type HomeActions = {
  onOpenMultiplayer: () => void;
  onOpenChampions: () => void;
  onExit: () => void;
  onClearSession: () => void;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  settingsService: SettingsService;
  playerProgressService: PlayerProgressService;
  userService: UserService;
  chatService: ChatService;
  teamService: TeamService;
  notificationService: NotificationService;
  rewardService: RewardService;
  matchPresenceService: MatchPresenceService;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  coins: number;
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  selectedChampionModelUrl: string | null;
  selectedChampionPreviewAnimation: ChampionPreviewAnimation | null;
  selectedChampionSplashImageUrl: string;
  selectedChampionThemeColor: string;
  isDefaultChampion: boolean;
  isSessionActive: boolean;
  currentUserId: string;
  selectedChampionStats: HomeSelectedChampionStats;
};

function createActionHandlers(
  actions: HomeActions,
  openSettingsModal: () => void,
  openExitConfirmModal: () => void
): Record<MenuActionId, () => void> {
  return {
    play: actions.onOpenMultiplayer,
    champions: actions.onOpenChampions,
    settings: openSettingsModal,
    exit: openExitConfirmModal
  };
}

export function renderHomeScreen(root: HTMLElement, actions: HomeActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const activeTab = actions.activeTab ?? DEFAULT_ACTIVE_TAB;
  const menu = renderScreenTemplate(root, template, '[data-screen="home"]', locale);
  const spotifyPlayer = createSpotifyLobbyPlayer({ root: menu });

  const homeView = renderHomeView({
    root,
    locale,
    activeTab,
    coins: actions.coins,
    playerName: actions.playerName,
    selectedChampionName: actions.selectedChampionName,
    selectedChampionLevel: actions.selectedChampionLevel,
    selectedChampionModelUrl: actions.selectedChampionModelUrl,
    selectedChampionPreviewAnimation: actions.selectedChampionPreviewAnimation,
    selectedChampionSplashImageUrl: actions.selectedChampionSplashImageUrl,
    selectedChampionThemeColor: actions.selectedChampionThemeColor,
    isDefaultChampion: actions.isDefaultChampion,
    isSessionActive: actions.isSessionActive,
    selectedChampionStats: actions.selectedChampionStats
  });

  const homeHud = mountHomeHud({
    menu: homeView.menu,
    locale,
    userService: actions.userService,
    rewardService: actions.rewardService,
    notificationService: actions.notificationService,
    initialCoins: actions.coins
  });

  const settingsModal = mountSettingsModal({
    locale,
    menu: homeView.menu,
    settingsService: actions.settingsService,
    playerProgressService: actions.playerProgressService,
    onApplyAudioSettings: actions.onApplyAudioSettings,
    onApplyLocale: actions.onApplyLocale,
    onClearSession: actions.onClearSession
  });

  const exitConfirmModal = mountExitConfirmModal({
    menu: homeView.menu,
    onConfirmExit: actions.onExit
  });

  const teamRoot = qs<HTMLElement>(menu, ".dab-team-queue");
  const rosterCountNode = qs<HTMLElement>(menu, '[data-slot="roster-count"]');
  const teamPanelSlot = qs<HTMLElement>(menu, '[data-slot="team-slots"]');
  const teamTabButton = qs<HTMLButtonElement>(menu, '[data-slot="team-tab"]');
  const teamToast = qs<HTMLElement>(menu, '[data-slot="team-toast"]');
  const onlineUsersCountNode = qs<HTMLElement>(menu, '[data-slot="online-users-count"]');

  const disposeTeamPanel = mountTeamPanel({
    locale,
    container: teamPanelSlot,
    rosterRoot: teamRoot,
    rosterCountNode,
    teamTabButton,
    teamService: actions.teamService,
    currentUserId: actions.currentUserId
  });

  const disposeTeamInvitePopup = mountTeamInvitePopup({
    locale,
    menu: homeView.menu,
    teamService: actions.teamService
  });

  let currentTeamMemberIds = new Set<string>();
  const seededTeam = actions.teamService.getCurrentTeam();
  if (seededTeam) {
    currentTeamMemberIds = new Set(seededTeam.members.map((teamMember) => teamMember.userId));
  }

  const disposeTeamMembersTracker = actions.teamService.onTeamUpdated((team) => {
    currentTeamMemberIds = new Set(team?.members.map((teamMember) => teamMember.userId) ?? []);
  });

  const chatPanelSlot = qs<HTMLElement>(menu, '[data-slot="global-chat-panel"]');
  const chatTriggerButton = menu.querySelector<HTMLButtonElement>(".dab-chat-button");
  const disposeChatPanel = mountChatPanel({
    locale,
    container: chatPanelSlot,
    chatService: actions.chatService,
    triggerButton: chatTriggerButton,
    currentUserId: actions.currentUserId,
    onInvitePlayer: (targetUserId) => {
      actions.teamService.sendInvite(targetUserId);
    },
    isPlayerInTeam: (userId) => currentTeamMemberIds.has(userId),
    onInviteStateChanged: (callback) => {
      return actions.teamService.onTeamUpdated(() => {
        callback();
      });
    }
  });

  const disposeChatPresenceListener = actions.chatService.onPresence((presence) => {
    onlineUsersCountNode.textContent = String(presence.onlineUsers);
  });

  const matchOnlineLabel = qs<HTMLElement>(menu, '[data-slot="match-online-label"]');
  const matchOnlineList = qs<HTMLElement>(menu, '[data-slot="match-online-list"]');

  const renderMatchPresence = (snapshot: { onlineCount: number; playerNicknames: string[] }): void => {
    matchOnlineLabel.textContent = t(locale, "home.match.online", {
      count: snapshot.onlineCount
    });

    matchOnlineList.replaceChildren();

    if (snapshot.playerNicknames.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = t(locale, "home.match.empty");
      matchOnlineList.appendChild(emptyItem);
      return;
    }

    snapshot.playerNicknames.slice(0, 6).forEach((nickname) => {
      const playerItem = document.createElement("li");
      playerItem.textContent = nickname;
      matchOnlineList.appendChild(playerItem);
    });
  };

  const disposeMatchPresenceListener = actions.matchPresenceService.onSnapshotChange((snapshot) => {
    renderMatchPresence(snapshot);
  });

  const disposeMatchPresenceError = actions.matchPresenceService.onError((error) => {
    console.warn("[global_match] Lobby presence unavailable.", error.message);
  });

  void actions.matchPresenceService.connect().catch((error: unknown) => {
    if (error instanceof Error) {
      console.warn("[global_match] Unable to connect lobby presence.", error.message);
    }
  });

  let teamToastTimeoutId: number | null = null;

  const clearTeamToast = (): void => {
    if (teamToastTimeoutId !== null) {
      window.clearTimeout(teamToastTimeoutId);
      teamToastTimeoutId = null;
    }

    teamToast.classList.remove("is-visible", "is-error", "is-success");
    teamToast.textContent = "";
  };

  const showTeamToast = (toast: TeamToast): void => {
    clearTeamToast();
    teamToast.textContent = toast.message;
    teamToast.classList.add("is-visible");

    if (toast.tone === "error") {
      teamToast.classList.add("is-error");
    }

    if (toast.tone === "success") {
      teamToast.classList.add("is-success");
    }

    teamToastTimeoutId = window.setTimeout(() => {
      clearTeamToast();
    }, 2600);
  };

  const disposeTeamToastListener = actions.teamService.onToast((toast) => {
    showTeamToast(toast);
  });

  void actions.teamService.connect().catch((error: unknown) => {
    if (error instanceof Error) {
      showTeamToast({
        message: error.message,
        tone: "error"
      });
    }
  });

  const actionHandlers = createActionHandlers(actions, settingsModal.open, exitConfirmModal.open);

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (homeView.menu.classList.contains("is-settings-open")) {
      return;
    }

    if (exitConfirmModal.isOpen()) {
      return;
    }

    if (homeHud.isNotificationModalOpen()) {
      return;
    }

    event.preventDefault();
    exitConfirmModal.open();
  };

  window.addEventListener("keydown", onWindowKeyDown);

  const disposeEvents = bindHomeEvents({
    menu,
    initialActiveTab: activeTab,
    onTabChange: (tab) => {
      actions.onNavigateTab?.(tab);
    },
    onAction: (actionId) => {
      actionHandlers[actionId]();
    }
  });

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
    disposeEvents();
    settingsModal.dispose();
    exitConfirmModal.dispose();
    disposeTeamMembersTracker();
    disposeTeamToastListener();
    clearTeamToast();
    disposeTeamInvitePopup();
    disposeTeamPanel();
    disposeChatPanel();
    disposeChatPresenceListener();
    disposeMatchPresenceListener();
    disposeMatchPresenceError();
    actions.matchPresenceService.disconnect();
    homeHud.dispose();
    destroySpotifyLobbyPlayer(spotifyPlayer);
    homeView.dispose();
  };
}
