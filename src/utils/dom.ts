import { GAME_CONFIG } from "@/config/game.config";

export interface AppShell {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
}

function ensureRootElement(): HTMLDivElement {
  const existingRoot = document.getElementById("app");

  if (existingRoot instanceof HTMLDivElement) {
    return existingRoot;
  }

  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);

  return root;
}

export function resetAppShell(): AppShell {
  const root = ensureRootElement();
  root.replaceChildren();

  const shell = document.createElement("div");
  shell.className = "game-shell";

  const canvas = document.createElement("canvas");
  canvas.id = GAME_CONFIG.canvasId;
  canvas.className = "game-canvas";
  canvas.setAttribute("aria-label", `${GAME_CONFIG.appName} render surface`);

  shell.append(canvas);
  root.append(shell);

  return {
    root,
    canvas
  };
}

function normaliseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown bootstrap error.";
}

export function renderFatalError(error: unknown): void {
  const root = ensureRootElement();
  root.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "fatal-error";

  const title = document.createElement("h1");
  title.textContent = "Bootstrap failed";

  const description = document.createElement("p");
  description.textContent = normaliseError(error);

  panel.append(title, description);
  root.append(panel);
}
