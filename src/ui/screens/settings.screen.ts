// Responsável por renderizar a tela de configurações e tratar retorno para Home.
import type { Locale } from "../../i18n";
import template from "../layout/settings.html?raw";
import { bindDelegatedClick } from "../components/dom";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

export type SettingsActions = {
  locale?: Locale;
  onBack: () => void;
};

export function renderSettingsScreen(root: HTMLElement, actions: SettingsActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  const screen = renderScreenTemplate(root, template, '[data-screen="settings"]', locale);

  return bindDelegatedClick(screen, "button[data-action='back']", () => {
    actions.onBack();
  });
}
