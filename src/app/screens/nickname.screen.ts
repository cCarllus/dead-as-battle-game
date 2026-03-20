// Responsável por renderizar a coleta de nickname e validar entrada do usuário.
import template from "../templates/nickname.html?raw";
import { t, type Locale } from "../i18n";
import { MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, normalizeNickname } from "@/shared/user/user.model";
import { bind, bindDelegatedClick, qs } from "../components/dom";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";
import type { PlayerProgressServiceResult } from "../services/player-progress.service";
import type { PlayerProgressImportPreview } from "../../persistence/types/player-progress.types";

export type NicknameActions = {
  locale?: Locale;
  onSubmit: (nickname: string) => void;
  onImportFileSelected: (
    file: File
  ) => Promise<PlayerProgressServiceResult<PlayerProgressImportPreview>>;
  onConfirmImport: () => Promise<PlayerProgressServiceResult<unknown>>;
};

export function renderNicknameScreen(root: HTMLElement, actions: NicknameActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const screen = renderScreenTemplate(root, template, '[data-screen="nickname"]', locale);

  const input = qs<HTMLInputElement>(screen, '[data-slot="nickname-input"]');
  const errorLabel = qs<HTMLElement>(screen, '[data-slot="error"]');
  const importInput = qs<HTMLInputElement>(screen, '[data-slot="import-file-input"]');
  const importFeedback = qs<HTMLElement>(screen, '[data-slot="import-feedback"]');
  const importPreview = qs<HTMLElement>(screen, '[data-slot="import-preview"]');
  const importPreviewName = qs<HTMLElement>(screen, '[data-slot="import-preview-name"]');
  const importPreviewMeta = qs<HTMLElement>(screen, '[data-slot="import-preview-meta"]');
  const importPreviewWarning = qs<HTMLElement>(screen, '[data-slot="import-preview-warning"]');
  input.placeholder = t(locale, "nick.placeholder");
  input.minLength = MIN_NICKNAME_LENGTH;
  input.maxLength = MAX_NICKNAME_LENGTH;

  let hasPreparedImport = false;

  const clearImportPreview = (): void => {
    hasPreparedImport = false;
    importPreview.hidden = true;
    importPreviewName.textContent = "";
    importPreviewMeta.textContent = "";
    importPreviewWarning.textContent = "";
  };

  const setImportFeedback = (message: string): void => {
    importFeedback.textContent = message;
  };

  const renderImportPreview = (preview: PlayerProgressImportPreview): void => {
    hasPreparedImport = true;
    importPreview.hidden = false;
    importPreviewName.textContent = t(locale, "nick.import.preview.name", {
      nickname: preview.nickname
    });
    importPreviewMeta.textContent = t(locale, "nick.import.preview.meta", {
      playerId: preview.playerId,
      updatedAt: new Date(preview.updatedAt).toLocaleString(locale)
    });
    importPreviewWarning.textContent = preview.warnings.join(" ");
  };

  const submitNickname = (): void => {
    const nickname = normalizeNickname(input.value);
    if (!nickname) {
      errorLabel.textContent = t(locale, "nick.error.min3");
      return;
    }

    errorLabel.textContent = "";
    actions.onSubmit(nickname);
  };

  const cleanups = [
    bindDelegatedClick(screen, "button[data-action='submit']", () => {
      submitNickname();
    }),
    bindDelegatedClick(screen, "button[data-action='choose-import']", () => {
      importInput.value = "";
      importInput.click();
    }),
    bindDelegatedClick(screen, "button[data-action='confirm-import']", async () => {
      if (!hasPreparedImport) {
        return;
      }

      const result = await actions.onConfirmImport();
      if (!result.ok) {
        setImportFeedback(result.error);
        return;
      }

      setImportFeedback(t(locale, "nick.import.success"));
      clearImportPreview();
    }),
    bind(importInput, "change", async () => {
      const file = importInput.files?.[0];
      if (!file) {
        return;
      }

      clearImportPreview();
      setImportFeedback(t(locale, "common.loading"));

      const result = await actions.onImportFileSelected(file);
      if (!result.ok) {
        setImportFeedback(result.error);
        return;
      }

      renderImportPreview({
        ...result.value,
        warnings: result.warnings
      });
      setImportFeedback(t(locale, "nick.import.ready"));
    }),
    bind(input, "keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      submitNickname();
    })
  ];

  requestAnimationFrame(() => {
    input.focus();
  });

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}
