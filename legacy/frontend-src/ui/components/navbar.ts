// Responsável por renderizar cabeçalho de navegação e indicadores de moeda da Home.
import { t, type Locale } from "../../i18n";
import { createMenuIcon } from "./menu-icon";
import { renderMenuLogo } from "./menu-logo";
import { MENU_NAV_ITEMS, type MenuTabId } from "../navigation/menu.model";

export type NavbarProps = {
  locale: Locale;
  activeTab: MenuTabId;
  coins?: number;
};

function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function renderNavbar(container: HTMLElement, props: NavbarProps): void {
  container.replaceChildren();

  const header = document.createElement("header");
  header.className = "dab-menu__header";

  const logo = renderMenuLogo();

  const nav = document.createElement("nav");
  nav.className = "dab-menu__nav";
  nav.setAttribute("aria-label", t(props.locale, "menu.aria.nav"));

  MENU_NAV_ITEMS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dab-menu__nav-btn";
    button.dataset.tab = item.id;

    const icon = createMenuIcon(item.iconId, { className: "dab-menu__nav-icon" });
    const label = document.createElement("span");
    label.className = "dab-menu__nav-label";
    label.textContent = t(props.locale, item.labelKey);

    button.append(icon, label);

    if (item.id === props.activeTab) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "page");
    }

    nav.appendChild(button);
  });

  const tools = document.createElement("div");
  tools.className = "dab-menu__tools";
  tools.dataset.slot = "menu-tools";

  const currency = document.createElement("div");
  currency.className = "dab-currency";
  currency.dataset.slot = "coins-display";

  const normalizedCoins = Math.max(0, Math.floor(props.coins ?? 0));
  const itemNode = document.createElement("div");
  itemNode.className = "dab-currency__item";
  itemNode.setAttribute("aria-label", t(props.locale, "menu.currency.coin", { value: formatNumber(props.locale, normalizedCoins) }));

  const icon = createMenuIcon("coin", { className: "dab-currency__icon dab-currency__icon--coin" });

  const value = document.createElement("span");
  value.className = "dab-currency__value";
  value.textContent = formatNumber(props.locale, normalizedCoins);

  itemNode.append(icon, value);
  currency.appendChild(itemNode);

  tools.append(currency);
  header.append(logo, nav, tools);
  container.appendChild(header);
}
