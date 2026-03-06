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
import type { NotificationInput, NotificationItem } from "../../models/notification.model";
import type { NotificationService } from "../../services/notification.service";
import type { RewardService } from "../../services/reward.service";
import type { UserService } from "../../services/user.service";
import { mountHomeHud } from "../components/home-hud";

export type HomeActions = {
  onOpenMultiplayer: () => void;
  onOpenChampions: () => void;
  onExit: () => void;
  onClearSession: () => void;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  settingsService: SettingsService;
  userService: UserService;
  chatService: ChatService;
  teamService: TeamService;
  notificationService: NotificationService;
  rewardService: RewardService;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  coins: number;
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  selectedChampionModelUrl: string | null;
  selectedChampionSplashImageUrl: string;
  selectedChampionThemeColor: string;
  isUserChampion: boolean;
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

function collectTrackedTeamInviteIds(notifications: readonly NotificationItem[]): Set<string> {
  const trackedInviteIds = new Set<string>();

  notifications.forEach((notification) => {
    if (notification.type !== "team_invite") {
      return;
    }

    const payload = notification.actionPayload as { inviteId?: string } | undefined;
    if (typeof payload?.inviteId !== "string") {
      return;
    }

    trackedInviteIds.add(payload.inviteId);
  });

  return trackedInviteIds;
}

function createTeamInviteNotification(params: {
  locale: Locale;
  fromNickname: string;
  inviteId: string;
  fromUserId: string;
}): NotificationInput {
  return {
    type: "team_invite",
    title: t(params.locale, "notifications.teamInvite.title"),
    message: t(params.locale, "team.invite.message", { nickname: params.fromNickname }),
    actionType: "team_invite",
    actionPayload: {
      inviteId: params.inviteId,
      fromUserId: params.fromUserId
    }
  };
}

function bindTeamInviteNotificationBridge(params: {
  locale: Locale;
  teamService: TeamService;
  notificationService: NotificationService;
  onNotificationsChanged: () => void;
}): () => void {
  const trackedInviteIds = collectTrackedTeamInviteIds(params.notificationService.getNotifications());

  return params.teamService.onPendingInvitesUpdated((pendingInvites) => {
    let hasNewNotification = false;

    pendingInvites.forEach((pendingInvite) => {
      if (trackedInviteIds.has(pendingInvite.id)) {
        return;
      }

      trackedInviteIds.add(pendingInvite.id);

      const createdNotification = params.notificationService.addNotification(
        createTeamInviteNotification({
          locale: params.locale,
          fromNickname: pendingInvite.fromNickname,
          inviteId: pendingInvite.id,
          fromUserId: pendingInvite.fromUserId
        })
      );

      if (createdNotification) {
        hasNewNotification = true;
      }
    });

    if (!hasNewNotification) {
      return;
    }

    params.onNotificationsChanged();
  });
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
    selectedChampionSplashImageUrl: actions.selectedChampionSplashImageUrl,
    selectedChampionThemeColor: actions.selectedChampionThemeColor,
    isUserChampion: actions.isUserChampion,
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

  const disposeTeamInviteNotificationBridge = bindTeamInviteNotificationBridge({
    locale,
    teamService: actions.teamService,
    notificationService: actions.notificationService,
    onNotificationsChanged: () => {
      homeHud.refresh();
    }
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
    disposeTeamInviteNotificationBridge();
    disposeTeamInvitePopup();
    disposeTeamPanel();
    disposeChatPanel();
    disposeChatPresenceListener();
    homeHud.dispose();
    destroySpotifyLobbyPlayer(spotifyPlayer);
    homeView.dispose();
  };
}
