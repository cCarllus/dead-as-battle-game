import template from "../layout/nickname.html?raw";
import { resolveLocale, t, type Locale } from "../../i18n";
import { MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, normalizeNickname } from "../../models/user";
import { clearElement, hydrateI18n, qs } from "../components/dom";

export type NicknameActions = {
  locale?: Locale;
  onSubmit: (nickname: string) => void;
};

export function renderNicknameScreen(root: HTMLElement, actions: NicknameActions): () => void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);

  clearElement(root);
  root.innerHTML = template;

  const screen = qs<HTMLElement>(root, '[data-screen="nickname"]');
  hydrateI18n(screen, locale);

  const input = qs<HTMLInputElement>(screen, '[data-slot="nickname-input"]');
  const errorLabel = qs<HTMLElement>(screen, '[data-slot="error"]');
  input.placeholder = t(locale, "nick.placeholder");
  input.minLength = MIN_NICKNAME_LENGTH;
  input.maxLength = MAX_NICKNAME_LENGTH;

  const submit = (): void => {
    const nickname = normalizeNickname(input.value);
    if (!nickname) {
      errorLabel.textContent = t(locale, "nick.error.min3");
      return;
    }

    errorLabel.textContent = "";
    actions.onSubmit(nickname);
  };

  const abortController = new AbortController();
  const { signal } = abortController;

  screen.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("button[data-action='submit']");
      if (button) {
        submit();
      }
    },
    { signal }
  );

  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    },
    { signal }
  );

  requestAnimationFrame(() => input.focus());

  return () => abortController.abort();
}
