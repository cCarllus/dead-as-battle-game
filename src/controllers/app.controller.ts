// Responsável por orquestrar fluxo de inicialização, navegação e integração entre telas e serviços.
import type { AppRouter, ScreenRegistry } from "../core/router";
import { createRouter } from "../core/router";
import type { AppStateStore } from "../core/state";
import type { SessionService } from "../core/storage";
import { t } from "../i18n";
import type { ChampionId } from "../models/champion.model";
import { getChampionCardsForUser, getSelectedChampionForUser } from "../services/champion.service";
import type { AudioService } from "../services/audio.service";
import { renderLoadingScreen } from "../ui/screens/loading.screen";
import { renderHomeScreen } from "../ui/screens/home.screen";
import { renderNicknameScreen } from "../ui/screens/nickname.screen";
import { renderSettingsScreen } from "../ui/screens/settings.screen";
import { renderChampionsScreen } from "../ui/screens/champions.screen";
import { renderNotesScreen } from "../ui/screens/notes.screen";
import type { UserService } from "../services/user.service";
import type { SettingsService } from "../services/settings.service";
import type { ChatService } from "../services/chat.service";
import type { TeamService } from "../services/team.service";
import type { NotificationService } from "../services/notification.service";
import type { RewardService } from "../services/reward.service";

export type AppControllerDependencies = {
  uiRoot: HTMLDivElement;
  state: AppStateStore;
  userService: UserService;
  sessionService: SessionService;
  audioService: AudioService;
  settingsService: SettingsService;
  chatService: ChatService;
  teamService: TeamService;
  notificationService: NotificationService;
  rewardService: RewardService;
  warmUpAssets: () => Promise<void>;
  startupDelayMs?: number;
};

export type AppController = {
  start: () => void;
  dispose: () => void;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function bindGlobalTeamInviteNotifications(params: {
  teamService: TeamService;
  notificationService: NotificationService;
  state: AppStateStore;
}): () => void {
  return params.teamService.onPendingInvitesUpdated((pendingInvites) => {
    const locale = params.state.get().locale;

    pendingInvites.forEach((pendingInvite) => {
      params.notificationService.addNotification({
        type: "team_invite",
        title: t(locale, "notifications.teamInvite.title"),
        message: t(locale, "team.invite.message", { nickname: pendingInvite.fromNickname }),
        actionType: "team_invite",
        actionPayload: {
          inviteId: pendingInvite.id,
          fromUserId: pendingInvite.fromUserId
        }
      });
    });
  });
}

function createScreenRegistry(
  userService: UserService,
  sessionService: SessionService,
  audioService: AudioService,
  settingsService: SettingsService,
  chatService: ChatService,
  teamService: TeamService,
  notificationService: NotificationService,
  rewardService: RewardService
): ScreenRegistry {
  return {
    loading: ({ uiRoot, state }) => {
      renderLoadingScreen(uiRoot, { locale: state.get().locale });
    },
    nickname: ({ uiRoot, state, goTo }) => {
      return renderNicknameScreen(uiRoot, {
        locale: state.get().locale,
        onSubmit: (nickname) => {
          const user = userService.registerUser(nickname);
          sessionService.start(user.id, user.nickname);
          state.patch({ activeMenuTab: "home" });
          goTo("home");
        }
      });
    },
    home: ({ uiRoot, state, goTo }) => {
      rewardService.generateRewardIfNeeded();
      const user = userService.getCurrentUser();
      if (!user) {
        chatService.disconnect();
        teamService.disconnect();
        sessionService.clear();
        goTo("nickname");
        return;
      }

      const selectedChampion = getSelectedChampionForUser(user);
      const selectedChampionProgress = user.champions[selectedChampion.id];
      const isSessionActive = sessionService.isActiveForUser(user.id);
      const selectedChampionStats = {
        championName: selectedChampion.displayName,
        kills: selectedChampionProgress.kills,
        deaths: selectedChampionProgress.deaths
      };

      return renderHomeScreen(uiRoot, {
        locale: state.get().locale,
        activeTab: state.get().activeMenuTab,
        onNavigateTab: (tab) => {
          state.patch({ activeMenuTab: tab });
          if (tab === "champions") {
            goTo("champions");
            return;
          }

          if (tab === "notes") {
            goTo("notes");
          }
        },
        onOpenMultiplayer: () => undefined,
        onOpenChampions: () => {
          state.patch({ activeMenuTab: "champions" });
          goTo("champions");
        },
        onExit: () => {
          chatService.disconnect();
          teamService.disconnect();
          userService.clearCurrentUser();
          sessionService.clear();
          goTo("nickname");
        },
        onClearSession: () => {
          chatService.disconnect();
          teamService.disconnect();
          userService.clearCurrentUser();
          sessionService.clear();
          settingsService.clear();
          document.documentElement.lang = "pt-BR";
          state.patch({ locale: "pt-BR" });
          state.patch({ activeMenuTab: "home" });
          goTo("nickname");
        },
        onApplyAudioSettings: (settings) => {
          audioService.applySettings(settings);
        },
        onApplyLocale: (locale) => {
          const currentLocale = state.get().locale;
          document.documentElement.lang = locale;
          if (currentLocale === locale) {
            return false;
          }

          state.patch({ locale });
          goTo("home");
          return true;
        },
        settingsService,
        userService,
        chatService,
        teamService,
        notificationService,
        rewardService,
        coins: user.coins,
        playerName: user.nickname,
        selectedChampionName: selectedChampion.displayName,
        selectedChampionLevel: selectedChampionProgress.level,
        selectedChampionModelUrl: selectedChampion.modelUrl,
        selectedChampionSplashImageUrl: selectedChampion.splashImageUrl,
        selectedChampionThemeColor: selectedChampion.themeColor,
        isUserChampion: selectedChampion.id === "user",
        isSessionActive,
        currentUserId: user.id,
        selectedChampionStats
      });
    },
    champions: ({ uiRoot, state, goTo }) => {
      const user = userService.getCurrentUser();
      if (!user) {
        goTo("nickname");
        return;
      }

      const cards = getChampionCardsForUser(user).map((champion) => ({
        id: champion.id,
        displayName: champion.displayName,
        universeName: champion.universeName,
        level: champion.level,
        imageUrl: champion.cardImageUrl,
        themeColor: champion.themeColor
      }));

      return renderChampionsScreen(uiRoot, {
        locale: state.get().locale,
        activeTab: state.get().activeMenuTab,
        coins: user.coins,
        userService,
        notificationService,
        cards,
        selectedChampionId: user.selectedChampionId,
        onNavigateTab: (tab) => {
          state.patch({ activeMenuTab: tab });
          if (tab === "home") {
            goTo("home");
            return;
          }

          if (tab === "notes") {
            goTo("notes");
          }
        },
        onPreviewSelection: (championId: ChampionId) => {
          audioService.playChampionSelect(championId);
        },
        onConfirmSelection: (championId: ChampionId) => {
          userService.selectChampion(championId);
          state.patch({ activeMenuTab: "home" });
          goTo("home");
        },
        onBack: () => {
          state.patch({ activeMenuTab: "home" });
          goTo("home");
        }
      });
    },
    notes: ({ uiRoot, state, goTo }) => {
      const user = userService.getCurrentUser();
      if (!user) {
        goTo("nickname");
        return;
      }

      return renderNotesScreen(uiRoot, {
        locale: state.get().locale,
        activeTab: state.get().activeMenuTab,
        coins: user.coins,
        userService,
        notificationService,
        onNavigateTab: (tab) => {
          state.patch({ activeMenuTab: tab });

          if (tab === "home") {
            goTo("home");
            return;
          }

          if (tab === "champions") {
            goTo("champions");
          }
        }
      });
    },
    settings: ({ uiRoot, state, goTo }) => {
      return renderSettingsScreen(uiRoot, {
        locale: state.get().locale,
        onBack: () => {
          goTo("home");
        }
      });
    }
  };
}

async function runStartupFlow(params: {
  router: AppRouter;
  userService: UserService;
  sessionService: SessionService;
  chatService: ChatService;
  teamService: TeamService;
  warmUpAssets: () => Promise<void>;
  startupDelayMs: number;
}): Promise<void> {
  params.router.goTo("loading");

  await Promise.all([params.warmUpAssets(), delay(params.startupDelayMs)]);

  if (!params.userService.hasUserProfile()) {
    params.chatService.disconnect();
    params.teamService.disconnect();
    params.sessionService.clear();
    params.router.goTo("nickname");
    return;
  }

  const user = params.userService.ensureUserProfile();
  params.sessionService.start(user.id, user.nickname);
  params.router.goTo("home");
}

export function createAppController({
  uiRoot,
  state,
  userService,
  sessionService,
  audioService,
  settingsService,
  chatService,
  teamService,
  notificationService,
  rewardService,
  warmUpAssets,
  startupDelayMs = 1200
}: AppControllerDependencies): AppController {
  const router = createRouter(
    {
      uiRoot,
      state
    },
    createScreenRegistry(
      userService,
      sessionService,
      audioService,
      settingsService,
      chatService,
      teamService,
      notificationService,
      rewardService
    )
  );

  let stopRewardTracking: (() => void) | null = null;
  const disposeTeamInviteNotifications = bindGlobalTeamInviteNotifications({
    teamService,
    notificationService,
    state
  });

  return {
    start: () => {
      if (!stopRewardTracking) {
        stopRewardTracking = rewardService.startActiveTracking();
      }

      void runStartupFlow({
        router,
        userService,
        sessionService,
        chatService,
        teamService,
        warmUpAssets,
        startupDelayMs
      });
    },
    dispose: () => {
      stopRewardTracking?.();
      stopRewardTracking = null;
      disposeTeamInviteNotifications();
      router.dispose();
      audioService.dispose();
      chatService.disconnect();
      teamService.disconnect();
    }
  };
}
