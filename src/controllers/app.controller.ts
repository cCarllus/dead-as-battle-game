// Responsável por orquestrar fluxo de inicialização, navegação e integração entre telas e serviços.
import { getUserLevel } from "../models/user";
import type { AppRouter, ScreenRegistry } from "../core/router";
import { createRouter } from "../core/router";
import type { AppStateStore } from "../core/state";
import type { SessionService } from "../core/storage";
import { renderLoadingScreen } from "../ui/screens/loading.screen";
import { renderHomeScreen } from "../ui/screens/home.screen";
import { renderNicknameScreen } from "../ui/screens/nickname.screen";
import { renderSettingsScreen } from "../ui/screens/settings.screen";
import type { UserService } from "../services/user.service";

export type AppControllerDependencies = {
  uiRoot: HTMLDivElement;
  state: AppStateStore;
  userService: UserService;
  sessionService: SessionService;
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

function createScreenRegistry(
  userService: UserService,
  sessionService: SessionService
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
          goTo("home");
        }
      });
    },
    home: ({ uiRoot, state, goTo }) => {
      const user = userService.getCurrentUser();
      if (!user) {
        sessionService.clear();
        goTo("nickname");
        return;
      }

      const snapshot = sessionService.getSnapshot();
      const isSessionActive = sessionService.isActiveForUser(user.id);
      const sessionNickname = snapshot?.userId === user.id ? snapshot.nickname : null;

      return renderHomeScreen(uiRoot, {
        locale: state.get().locale,
        activeTab: state.get().activeMenuTab,
        onNavigateTab: (tab) => {
          state.patch({ activeMenuTab: tab });
        },
        onOpenConfig: () => {
          goTo("settings");
        },
        onOpenMultiplayer: () => undefined,
        onExit: () => {
          userService.clearCurrentUser();
          sessionService.clear();
          goTo("nickname");
        },
        playerName: sessionNickname ?? user.nickname,
        playerLevel: getUserLevel(user),
        isSessionActive
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
  warmUpAssets: () => Promise<void>;
  startupDelayMs: number;
}): Promise<void> {
  params.router.goTo("loading");

  await Promise.all([params.warmUpAssets(), delay(params.startupDelayMs)]);

  const user = params.userService.getCurrentUser();
  if (!user) {
    params.sessionService.clear();
    params.router.goTo("nickname");
    return;
  }

  params.sessionService.start(user.id, user.nickname);
  params.router.goTo("home");
}

export function createAppController({
  uiRoot,
  state,
  userService,
  sessionService,
  warmUpAssets,
  startupDelayMs = 1200
}: AppControllerDependencies): AppController {
  const router = createRouter(
    {
      uiRoot,
      state
    },
    createScreenRegistry(userService, sessionService)
  );

  return {
    start: () => {
      void runStartupFlow({
        router,
        userService,
        sessionService,
        warmUpAssets,
        startupDelayMs
      });
    },
    dispose: () => {
      router.dispose();
    }
  };
}
