import template from "../layout/settings.html?raw";
import { resolveLocale, type Locale } from "../../i18n";
import { clearElement, hydrateI18n, qs } from "../components/dom";

export type SettingsActions = {
  locale?: Locale;
  onBack: () => void;
};

export function renderSettingsScreen(root: HTMLElement, actions: SettingsActions): () => void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);

  clearElement(root);
  root.innerHTML = template;

  const screen = qs<HTMLElement>(root, '[data-screen="settings"]');
  hydrateI18n(screen, locale);

  const abortController = new AbortController();
  screen.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("button[data-action='back']");
      if (button) {
        actions.onBack();
      }
    },
    { signal: abortController.signal }
  );

  return () => abortController.abort();
}
