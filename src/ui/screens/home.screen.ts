// Responsável por compor renderização e interações da tela Home.
import template from "../layout/home.html?raw";
import type { Locale } from "../../i18n";
import { DEFAULT_ACTIVE_TAB, type MenuTabId } from "../navigation/menu.model";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";
import { bindHomeEvents } from "./home.events";
import { renderHomeView } from "./home.view";
import type { MenuActionId } from "./home.model";
import { mountSettingsModal } from "../components/settings-modal";
import { mountExitConfirmModal } from "../components/exit-confirm-modal";
import type { GameSettings, SettingsService } from "../../services/settings.service";
import type { ChatService } from "../../services/chat.service";
import { mountChatPanel } from "../components/chat-panel";
import type { TeamService, TeamToast } from "../../services/team.service";
import { mountTeamPanel } from "../components/team-panel";
import { mountTeamInvitePopup } from "../components/team-invite-popup";
import { qs } from "../components/dom";

export type HomeActions = {
  onOpenMultiplayer: () => void;
  onOpenChampions: () => void;
  onExit: () => void;
  onClearSession: () => void;
  onApplyAudioSettings: (settings: GameSettings) => void;
  onApplyLocale: (locale: Locale) => boolean;
  settingsService: SettingsService;
  chatService: ChatService;
  teamService: TeamService;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  selectedChampionModelUrl: string | null;
  selectedChampionSplashImageUrl: string;
  selectedChampionThemeColor: string;
  isUserChampion: boolean;
  isSessionActive: boolean;
  currentUserId: string;
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

  const homeView = renderHomeView({
    root,
    locale,
    activeTab,
    playerName: actions.playerName,
    selectedChampionName: actions.selectedChampionName,
    selectedChampionLevel: actions.selectedChampionLevel,
    selectedChampionModelUrl: actions.selectedChampionModelUrl,
    selectedChampionSplashImageUrl: actions.selectedChampionSplashImageUrl,
    selectedChampionThemeColor: actions.selectedChampionThemeColor,
    isUserChampion: actions.isUserChampion,
    isSessionActive: actions.isSessionActive
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
  const seedTeam = actions.teamService.getCurrentTeam();
  if (seedTeam) {
    currentTeamMemberIds = new Set(seedTeam.members.map((member) => member.userId));
  }

  const disposeTeamMembersTracker = actions.teamService.onTeamUpdated((team) => {
    currentTeamMemberIds = new Set(team?.members.map((member) => member.userId) ?? []);
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
    homeView.dispose();
  };
}
