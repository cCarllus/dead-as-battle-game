import { Engine } from "@babylonjs/core";
import { renderCharacterSelection, type CharacterId } from "./characterSelection";
import { renderConfig } from "./config";
import { startLocalGame } from "./game";
import { renderMenu } from "./menu";
import { clearElement, createTitle, injectGlobalStyles } from "./utils/ui";

injectGlobalStyles();

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;

if (!canvas || !uiRoot) {
  throw new Error("Elementos principais do app não encontrados.");
}

const appCanvas: HTMLCanvasElement = canvas;
const appUiRoot: HTMLDivElement = uiRoot;

const engine = new Engine(appCanvas, true);
let currentGameCleanup: (() => void) | null = null;

const renderLoop = (): void => {
  if (engine.scenes.length > 0) {
    engine.scenes[0].render();
  }
};

engine.runRenderLoop(renderLoop);
window.addEventListener("resize", () => engine.resize());

function stopGameIfNeeded(): void {
  if (currentGameCleanup) {
    currentGameCleanup();
    currentGameCleanup = null;
  }
}

function showSplashAndGoToMenu(): void {
  stopGameIfNeeded();
  clearElement(appUiRoot);

  const container = document.createElement("section");
  container.className = "screen";
  container.appendChild(createTitle("Dead as Battle"));

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Carregando...";
  container.appendChild(subtitle);

  appUiRoot.appendChild(container);

  window.setTimeout(showMenu, 1800);
}

function showMenu(): void {
  stopGameIfNeeded();

  renderMenu(appUiRoot, {
    onOpenConfig: showConfig,
    onOpenMultiplayer: showCharacterSelection,
    onExit: () => {
      clearElement(appUiRoot);
      const message = document.createElement("section");
      message.className = "screen";
      message.appendChild(createTitle("Até logo!"));
      appUiRoot.appendChild(message);
    }
  });
}

function showConfig(): void {
  stopGameIfNeeded();
  renderConfig(appUiRoot, showMenu);
}

function showCharacterSelection(): void {
  stopGameIfNeeded();

  renderCharacterSelection(appUiRoot, {
    onSelect: (character: CharacterId) => {
      clearElement(appUiRoot);
      currentGameCleanup = startLocalGame(engine, appCanvas, character);
    },
    onBack: showMenu
  });
}

showSplashAndGoToMenu();
