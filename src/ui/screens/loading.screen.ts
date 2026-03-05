// Responsável por renderizar a tela de carregamento inicial da aplicação.
import template from "../layout/loading.html?raw";
import type { Locale } from "../../i18n";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

export type LoadingActions = {
  locale?: Locale;
};

export function renderLoadingScreen(root: HTMLElement, actions: LoadingActions = {}): void {
  const locale = resolveScreenLocale(actions.locale);
  renderScreenTemplate(root, template, '[data-screen="loading"]', locale);
}
