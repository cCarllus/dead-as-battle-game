import "@/styles/global.css";
import { GameApp } from "@/app/game-app";
import { renderFatalError, resetAppShell } from "@/utils/dom";

let app: GameApp | null = null;

async function bootstrap(): Promise<void> {
  const { canvas } = resetAppShell();

  app = GameApp.create({
    canvas
  });

  await app.start();
}

void bootstrap().catch((error: unknown) => {
  console.error("Failed to bootstrap Dead As Battleground.", error);
  renderFatalError(error);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app?.dispose();
    app = null;
  });
}
