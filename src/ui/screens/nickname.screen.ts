// Responsável por renderizar a coleta de nickname e validar entrada do usuário.
import template from "../layout/nickname.html?raw";
import { t, type Locale } from "../../i18n";
import { MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, normalizeNickname } from "../../models/user";
import { bind, bindDelegatedClick, qs } from "../components/dom";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

export type NicknameActions = {
  locale?: Locale;
  onSubmit: (nickname: string) => void;
};

export function renderNicknameScreen(root: HTMLElement, actions: NicknameActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const screen = renderScreenTemplate(root, template, '[data-screen="nickname"]', locale);

  const input = qs<HTMLInputElement>(screen, '[data-slot="nickname-input"]');
  const errorLabel = qs<HTMLElement>(screen, '[data-slot="error"]');
  input.placeholder = t(locale, "nick.placeholder");
  input.minLength = MIN_NICKNAME_LENGTH;
  input.maxLength = MAX_NICKNAME_LENGTH;

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
