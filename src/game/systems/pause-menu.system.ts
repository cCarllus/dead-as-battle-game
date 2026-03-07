// Responsável por controlar abertura/fechamento do menu de pausa e delegar ações de resume/settings/exit.

export type PauseMenuSystem = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  dispose: () => void;
};

export type CreatePauseMenuSystemOptions = {
  menu: HTMLElement;
  overlayButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  exitButton: HTMLButtonElement;
  onResume: () => void;
  onOpenSettings: () => void;
  onExitMatch: () => void;
};

export function createPauseMenuSystem(options: CreatePauseMenuSystemOptions): PauseMenuSystem {
  let opened = false;

  const renderState = (): void => {
    options.menu.hidden = !opened;
    options.menu.setAttribute("aria-hidden", String(!opened));
    options.menu.classList.toggle("is-open", opened);
  };

  const open = (): void => {
    if (opened) {
      return;
    }

    opened = true;
    renderState();
  };

  const close = (): void => {
    if (!opened) {
      return;
    }

    opened = false;
    renderState();
  };

  const onOverlayClick = (): void => {
    options.onResume();
  };

  const onResumeClick = (): void => {
    options.onResume();
  };

  const onSettingsClick = (): void => {
    options.onOpenSettings();
  };

  const onExitClick = (): void => {
    options.onExitMatch();
  };

  options.overlayButton.addEventListener("click", onOverlayClick);
  options.resumeButton.addEventListener("click", onResumeClick);
  options.settingsButton.addEventListener("click", onSettingsClick);
  options.exitButton.addEventListener("click", onExitClick);

  renderState();

  return {
    open,
    close,
    isOpen: () => opened,
    dispose: () => {
      options.overlayButton.removeEventListener("click", onOverlayClick);
      options.resumeButton.removeEventListener("click", onResumeClick);
      options.settingsButton.removeEventListener("click", onSettingsClick);
      options.exitButton.removeEventListener("click", onExitClick);
      close();
    }
  };
}
