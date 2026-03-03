import { Engine } from "@babylonjs/core";
import { createArenaScene } from "../game/scenes/arena.scene";
import { createLobbyScene } from "../game/scenes/lobby.scene";
import { t } from "../i18n";
import { clearElement } from "../ui/components/dom";
import { renderCharacterSelectScreen } from "../ui/screens/characterSelect.screen";
import { renderLobbyScreen } from "../ui/screens/lobby.screen";
import { renderMainMenuScreen } from "../ui/screens/mainMenu.screen";
import { renderSettingsScreen } from "../ui/screens/settings.screen";
import "../ui/styles/ui.css";
import { createRouter } from "./router";
import { createAppState } from "./state";

function renderArenaHud(root: HTMLElement, onBack: () => void): () => void {
  clearElement(root);

  const hud = document.createElement("div");
  hud.className = "arena-hud";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "menu-button";
  backButton.textContent = "Voltar ao menu";
  backButton.addEventListener("click", onBack);

  hud.appendChild(backButton);
  root.appendChild(hud);

  return () => {
    backButton.removeEventListener("click", onBack);
  };
}

export function bootstrap(): void {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;

  if (!canvas || !uiRoot) {
    throw new Error("Elementos principais do app não encontrados.");
  }

  const engine = new Engine(canvas, true);
  engine.runRenderLoop(() => {
    const activeScene = engine.scenes[0];
    if (activeScene) {
      activeScene.render();
    }
  });

  const resizeHandler = (): void => engine.resize();
  window.addEventListener("resize", resizeHandler);

  const state = createAppState();

  const router = createRouter(
    {
      engine,
      canvas,
      uiRoot,
      state
    },
    {
      mainMenu: ({ uiRoot: root, state: store, goTo }) => {
        return renderMainMenuScreen(root, {
          locale: store.get().locale,
          activeTab: store.get().activeMenuTab,
          onNavigateTab: (tab) => store.patch({ activeMenuTab: tab }),
          onOpenConfig: () => goTo("settings"),
          onOpenMultiplayer: () => goTo("characterSelect"),
          onExit: () => goTo("exit")
        });
      },
      settings: ({ uiRoot: root, state: store, goTo }) => {
        return renderSettingsScreen(root, {
          locale: store.get().locale,
          onBack: () => goTo("mainMenu")
        });
      },
      characterSelect: ({ uiRoot: root, state: store, goTo }) => {
        return renderCharacterSelectScreen(root, {
          locale: store.get().locale,
          onBack: () => goTo("mainMenu"),
          onSelect: (character) => {
            store.patch({ selectedCharacter: character });
            goTo("lobby");
          }
        });
      },
      lobby: ({ engine: appEngine, canvas: appCanvas, uiRoot: root, state: store, goTo }) => {
        const selectedCharacter = store.get().selectedCharacter;
        const lobbyScene = createLobbyScene(appEngine, appCanvas, selectedCharacter);

        const screenCleanup = renderLobbyScreen(root, {
          locale: store.get().locale,
          selectedCharacter,
          onStart: () => goTo("arena"),
          onChangeCharacter: () => goTo("characterSelect"),
          onBack: () => goTo("mainMenu")
        });

        return () => {
          screenCleanup();
          lobbyScene.scene.dispose();
        };
      },
      arena: ({ engine: appEngine, canvas: appCanvas, uiRoot: root, state: store, goTo }) => {
        const selectedCharacter = store.get().selectedCharacter;
        const arena = createArenaScene(appEngine, appCanvas, selectedCharacter);
        const hudCleanup = renderArenaHud(root, () => goTo("mainMenu"));

        return () => {
          hudCleanup();
          clearElement(root);
          arena.scene.dispose();
        };
      },
      exit: ({ uiRoot: root, state: store }) => {
        clearElement(root);

        const message = document.createElement("section");
        message.className = "screen";

        const title = document.createElement("h1");
        title.className = "screen-title";
        title.textContent = t(store.get().locale, "exit.goodbye");

        message.appendChild(title);
        root.appendChild(message);

        return () => clearElement(root);
      }
    }
  );

  router.goTo("mainMenu");

  window.addEventListener("beforeunload", () => {
    router.dispose();
    window.removeEventListener("resize", resizeHandler);
    engine.dispose();
  });
}
