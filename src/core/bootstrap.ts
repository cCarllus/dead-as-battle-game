import { renderLoadingScreen } from "../ui/screens/loading.screen";
import { renderMainMenuScreen } from "../ui/screens/mainMenu.screen";
import { renderNicknameScreen } from "../ui/screens/nickname.screen";
import { renderSettingsScreen } from "../ui/screens/settings.screen";
import "../ui/styles/ui.css";
import { clearCurrentUser, getCurrentUser, registerUser } from "../services/user.service";
import { getUserLevel } from "../models/user";
import { warmUpAssetCache } from "./cache";
import { createRouter } from "./router";
import { createAppState } from "./state";
import { clearSession, getSessionSnapshot, isSessionActiveForUser, startSession } from "./storage";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStartupFlow(
  router: { goTo: (screen: "loading" | "nickname" | "mainMenu") => void }
): Promise<void> {
  router.goTo("loading");

  await Promise.all([warmUpAssetCache(), delay(1200)]);

  const user = getCurrentUser();
  if (!user) {
    clearSession();
    router.goTo("nickname");
    return;
  }

  startSession(user.id, user.nickname);
  router.goTo("mainMenu");
}

export function bootstrap(): void {
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;

  if (!uiRoot) {
    throw new Error("Elemento principal de UI não encontrado.");
  }

  const state = createAppState();

  const router = createRouter(
    {
      uiRoot,
      state
    },
    {
      loading: ({ uiRoot: root, state: store }) => {
        renderLoadingScreen(root, { locale: store.get().locale });
      },
      nickname: ({ uiRoot: root, state: store, goTo }) => {
        return renderNicknameScreen(root, {
          locale: store.get().locale,
          onSubmit: (nickname) => {
            const user = registerUser(nickname);
            startSession(user.id, user.nickname);
            goTo("mainMenu");
          }
        });
      },
      mainMenu: ({ uiRoot: root, state: store, goTo }) => {
        const user = getCurrentUser();
        if (!user) {
          clearSession();
          goTo("nickname");
          return;
        }

        const session = getSessionSnapshot();
        const isActive = isSessionActiveForUser(user.id);
        const sessionNickname = session?.userId === user.id ? session.nickname : null;

        return renderMainMenuScreen(root, {
          locale: store.get().locale,
          activeTab: store.get().activeMenuTab,
          onNavigateTab: (tab) => store.patch({ activeMenuTab: tab }),
          onOpenConfig: () => goTo("settings"),
          onOpenMultiplayer: () => undefined,
          onExit: () => {
            clearCurrentUser();
            clearSession();
            goTo("nickname");
          },
          playerName: sessionNickname ?? user.nickname,
          playerLevel: getUserLevel(user),
          isSessionActive: isActive
        });
      },
      settings: ({ uiRoot: root, state: store, goTo }) => {
        return renderSettingsScreen(root, {
          locale: store.get().locale,
          onBack: () => goTo("mainMenu")
        });
      }
    }
  );

  void runStartupFlow(router);

  window.addEventListener("beforeunload", () => {
    router.dispose();
  });
}
