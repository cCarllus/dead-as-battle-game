// Responsável por confirmar saída da Home antes de limpar sessão do usuário.
import { bind, qs } from "./dom";

const MODAL_HIDE_TRANSITION_MS = 180;

export type ExitConfirmModalController = {
  open: () => void;
  isOpen: () => boolean;
  dispose: () => void;
};

export type MountExitConfirmModalOptions = {
  menu: HTMLElement;
  onConfirmExit: () => void;
};

export function mountExitConfirmModal({
  menu,
  onConfirmExit
}: MountExitConfirmModalOptions): ExitConfirmModalController {
  const modal = qs<HTMLElement>(menu, '[data-slot="exit-confirm-modal"]');
  const panel = qs<HTMLElement>(menu, '[data-slot="exit-confirm-panel"]');
  const cancelButton = qs<HTMLButtonElement>(menu, 'button[data-exit-action="cancel"]');
  const confirmButton = qs<HTMLButtonElement>(menu, 'button[data-exit-action="confirm"]');
  const overlayButton = qs<HTMLButtonElement>(menu, 'button[data-exit-action="overlay-close"]');

  let opened = false;
  let hideTimeoutId: number | null = null;

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (!opened || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    close();
  };

  function open(): void {
    if (opened) {
      return;
    }

    if (hideTimeoutId !== null) {
      window.clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }

    opened = true;
    modal.hidden = false;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    window.addEventListener("keydown", onWindowKeyDown);
    window.setTimeout(() => {
      confirmButton.focus();
    }, 10);
  }

  function close(): void {
    if (!opened) {
      return;
    }

    opened = false;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    window.removeEventListener("keydown", onWindowKeyDown);

    if (hideTimeoutId !== null) {
      window.clearTimeout(hideTimeoutId);
    }

    hideTimeoutId = window.setTimeout(() => {
      if (opened) {
        return;
      }

      modal.hidden = true;
      hideTimeoutId = null;
    }, MODAL_HIDE_TRANSITION_MS);
  }

  const cleanups = [
    bind(cancelButton, "click", () => {
      close();
    }),
    bind(overlayButton, "click", () => {
      close();
    }),
    bind(confirmButton, "click", () => {
      close();
      onConfirmExit();
    }),
    bind(panel, "click", (event) => {
      event.stopPropagation();
    })
  ];

  return {
    open,
    isOpen: () => opened,
    dispose: () => {
      if (hideTimeoutId !== null) {
        window.clearTimeout(hideTimeoutId);
        hideTimeoutId = null;
      }

      window.removeEventListener("keydown", onWindowKeyDown);
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    }
  };
}

