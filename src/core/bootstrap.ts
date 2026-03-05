// Responsável por compor dependências da aplicação e inicializar o ciclo de vida principal.
import "../ui/styles/ui.css";
import { createAppController } from "../controllers/app.controller";
import { warmUpAssetCache } from "./cache";
import { createAppState } from "./state";
import { createSessionService } from "./storage";
import { createUserRepository } from "../repositories/user.repository";
import { createUserService } from "../services/user.service";

export function bootstrap(): void {
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement | null;
  if (!uiRoot) {
    throw new Error("Elemento principal de UI não encontrado.");
  }

  const appState = createAppState();
  const userService = createUserService({ repository: createUserRepository() });
  const sessionService = createSessionService();

  const appController = createAppController({
    uiRoot,
    state: appState,
    userService,
    sessionService,
    warmUpAssets: warmUpAssetCache
  });

  appController.start();

  window.addEventListener("beforeunload", () => {
    appController.dispose();
  });
}
