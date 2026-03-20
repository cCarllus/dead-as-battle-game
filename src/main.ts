import { bootstrap as bootstrapApp } from "@/app/core/bootstrap";
import { renderFatalError } from "@/utils/dom";

let appHandle: { dispose: () => void } | null = null;

function ensureAppRoot(): HTMLDivElement {
  const existingRoot = document.getElementById("app");

  if (existingRoot instanceof HTMLDivElement) {
    return existingRoot;
  }

  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);

  return root;
}

function prepareApplicationShell(): HTMLDivElement {
  const root = ensureAppRoot();
  root.replaceChildren();

  const uiRoot = document.createElement("div");
  uiRoot.id = "ui-root";
  root.append(uiRoot);

  return uiRoot;
}

function bootstrap(): void {
  prepareApplicationShell();
  appHandle = bootstrapApp();
}

try {
  bootstrap();
} catch (error: unknown) {
  console.error("Failed to bootstrap Dead As Battleground.", error);
  renderFatalError(error);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    appHandle?.dispose();
    appHandle = null;
    const root = document.getElementById("app");
    root?.replaceChildren();
  });
}
