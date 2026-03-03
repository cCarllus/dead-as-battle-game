import template from "../layout/loading.html?raw";
import { resolveLocale, type Locale } from "../../i18n";
import { clearElement, hydrateI18n, qs } from "../components/dom";

export type LoadingActions = {
  locale?: Locale;
};

export function renderLoadingScreen(root: HTMLElement, actions: LoadingActions = {}): void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);

  clearElement(root);
  root.innerHTML = template;

  const screen = qs<HTMLElement>(root, '[data-screen="loading"]');
  hydrateI18n(screen, locale);
}
