// Responsável por padronizar renderização inicial de templates de tela com hidratação de i18n.
import { hydrateI18n, clearElement, qs } from "../components/dom";
import { resolveLocale, type Locale } from "../../i18n";
import { APP_VERSION_LABEL } from "../../config/version";

function mountVersionWatermark(root: HTMLElement): void {
  const watermark = document.createElement("span");
  watermark.className = "dab-version-watermark";
  watermark.setAttribute("aria-label", "Versão do jogo");
  watermark.textContent = APP_VERSION_LABEL;
  root.appendChild(watermark);
}

export function resolveScreenLocale(locale: Locale | undefined): Locale {
  return resolveLocale(locale ?? document.documentElement.lang);
}

export function renderScreenTemplate(
  root: HTMLElement,
  template: string,
  screenSelector: string,
  locale: Locale
): HTMLElement {
  clearElement(root);
  root.innerHTML = template;

  const screen = qs<HTMLElement>(root, screenSelector);
  hydrateI18n(screen, locale);
  mountVersionWatermark(root);

  return screen;
}
