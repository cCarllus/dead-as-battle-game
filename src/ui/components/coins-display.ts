// Responsável por renderizar e atualizar o indicador de moedas no topo da interface.
import type { Locale } from "../../i18n";

export type CoinsDisplayOptions = {
  container: HTMLElement;
  locale: Locale;
  initialCoins: number;
};

export type CoinsDisplayHandle = {
  setCoins: (coins: number) => void;
  dispose: () => void;
};

function formatCoins(locale: Locale, coins: number): string {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.floor(coins)));
}

export function mountCoinsDisplay(options: CoinsDisplayOptions): CoinsDisplayHandle {
  const root = document.createElement("div");
  root.className = "dab-currency dab-coins-display";

  const item = document.createElement("div");
  item.className = "dab-currency__item";

  const icon = document.createElement("span");
  icon.className = "dab-currency__icon dab-currency__icon--coin";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "M";

  const value = document.createElement("span");
  value.className = "dab-currency__value";

  item.append(icon, value);
  root.appendChild(item);
  options.container.appendChild(root);

  const setCoins = (coins: number): void => {
    const normalizedCoins = Math.max(0, Math.floor(coins));
    root.setAttribute("aria-label", `Moedas: ${formatCoins(options.locale, normalizedCoins)}`);
    value.textContent = formatCoins(options.locale, normalizedCoins);
  };

  setCoins(options.initialCoins);

  return {
    setCoins,
    dispose: () => {
      root.remove();
    }
  };
}
