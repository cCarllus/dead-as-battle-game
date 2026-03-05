// Responsável por utilitários reutilizáveis de manipulação de DOM e hidratação de traduções.
import { t, type Locale, type TranslationKey } from "../../i18n";

export function clearElement(element: HTMLElement): void {
  element.replaceChildren();
}

export function qs<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Elemento não encontrado: ${selector}`);
  }

  return node;
}

export function qsa<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function bind<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  element.addEventListener(eventName, handler as EventListener, options);
  return () => {
    element.removeEventListener(eventName, handler as EventListener, options);
  };
}

export function bindDelegatedClick(
  root: HTMLElement,
  selector: string,
  handler: (button: HTMLButtonElement, event: MouseEvent) => void,
  options?: AddEventListenerOptions
): () => void {
  return bind(
    root,
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest<HTMLButtonElement>(selector);
      if (!button || !root.contains(button)) {
        return;
      }

      handler(button, event);
    },
    options
  );
}

export function hydrateI18n(root: ParentNode, locale: Locale): void {
  qsa<HTMLElement>(root, "[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n as TranslationKey | undefined;
    if (!key) {
      return;
    }

    element.textContent = t(locale, key);
  });

  qsa<HTMLElement>(root, "[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel as TranslationKey | undefined;
    if (!key) {
      return;
    }

    element.setAttribute("aria-label", t(locale, key));
  });
}
