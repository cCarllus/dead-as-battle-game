// Responsible for the death/respawn overlay modal: displaying death info, respawn button, and back-to-lobby option.
import type { Locale } from "../../i18n";
import { bind } from "../components/dom";

const DEATH_SCREEN_DELAY_MS = 1800;

export type MatchDeathModalOptions = {
  locale: Locale;
  deathModal: HTMLElement;
  deathModalTitle: HTMLElement;
  deathModalMessage: HTMLElement;
  deathModalBackLobbyButton: HTMLButtonElement;
  deathModalRespawnButton: HTMLButtonElement;
  onLeaveMatch: () => void;
  onRespawnRequest: () => void;
  onOpen: () => void;
  onClose: () => void;
};

export type MatchDeathModalHandle = {
  show(params: { deadAt: number | null }): void;
  hide(): void;
  isVisible(): boolean;
  tick(now: number): void;
  setRespawnComplete(): void;
  dispose(): void;
};

export function createMatchDeathModal(options: MatchDeathModalOptions): MatchDeathModalHandle {
  let deathModalOpen = false;
  let deathModalRevealAtMs = 0;
  let respawnRequestPending = false;
  let pendingDeath: { deadAt: number | null } | null = null;

  const locale = options.locale;

  // Localize static labels
  options.deathModalTitle.textContent = locale === "pt-BR" ? "Voc\u00ea morreu" : "You Died";
  options.deathModalMessage.textContent =
    locale === "pt-BR"
      ? "Escolha voltar ao lobby ou renascer para continuar a batalha."
      : "Choose to return to the lobby or respawn and continue fighting.";
  options.deathModalBackLobbyButton.textContent = locale === "pt-BR" ? "Voltar ao lobby" : "Back to lobby";
  options.deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascer" : "Respawn";

  const setDeathModalOpen = (open: boolean): void => {
    if (deathModalOpen === open) {
      return;
    }

    deathModalOpen = open;
    options.deathModal.hidden = !open;
    options.deathModal.classList.toggle("is-open", open);
    options.deathModal.setAttribute("aria-hidden", String(!open));

    if (open) {
      options.onOpen();
    } else {
      options.onClose();
    }
  };

  const disposeBackLobbyClick = bind(options.deathModalBackLobbyButton, "click", () => {
    options.onLeaveMatch();
  });

  const disposeRespawnClick = bind(options.deathModalRespawnButton, "click", () => {
    if (respawnRequestPending) {
      return;
    }

    respawnRequestPending = true;
    options.deathModalRespawnButton.disabled = true;
    options.deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascendo..." : "Respawning...";
    options.onRespawnRequest();
  });

  // Initial state
  setDeathModalOpen(false);

  return {
    show(params) {
      pendingDeath = params;
      if (deathModalRevealAtMs <= 0) {
        deathModalRevealAtMs = (params.deadAt ?? Date.now()) + DEATH_SCREEN_DELAY_MS;
      }
      setDeathModalOpen(Date.now() >= deathModalRevealAtMs);
    },
    hide() {
      pendingDeath = null;
      deathModalRevealAtMs = 0;

      if (respawnRequestPending) {
        respawnRequestPending = false;
        options.deathModalRespawnButton.disabled = false;
        options.deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascer" : "Respawn";
      }

      setDeathModalOpen(false);
    },
    isVisible() {
      return deathModalOpen;
    },
    tick(now: number) {
      if (pendingDeath && deathModalRevealAtMs > 0 && !deathModalOpen && now >= deathModalRevealAtMs) {
        setDeathModalOpen(true);
      }
    },
    setRespawnComplete() {
      if (respawnRequestPending) {
        respawnRequestPending = false;
        options.deathModalRespawnButton.disabled = false;
        options.deathModalRespawnButton.textContent = locale === "pt-BR" ? "Renascer" : "Respawn";
      }
    },
    dispose() {
      disposeBackLobbyClick();
      disposeRespawnClick();
      pendingDeath = null;
      deathModalRevealAtMs = 0;
      respawnRequestPending = false;
      setDeathModalOpen(false);
    }
  };
}
