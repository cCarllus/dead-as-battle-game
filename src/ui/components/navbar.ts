import { t, type Locale } from "../../i18n";
import { MENU_NAV_ITEMS, type MenuTabId } from "../navigation/menu.model";
import { CURRENCY_ITEMS } from "../screens/home.model";

export type NavbarProps = {
  locale: Locale;
  activeTab: MenuTabId;
};

function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function renderNavbar(container: HTMLElement, props: NavbarProps): void {
  container.replaceChildren();

  const header = document.createElement("header");
  header.className = "dab-menu__header";

  const logo = document.createElement("div");
  logo.className = "dab-logo";

  const logoMark = document.createElement("span");
  logoMark.className = "dab-logo__mark";
  logoMark.setAttribute("aria-hidden", "true");

  const logoText = document.createElement("span");
  logoText.className = "dab-logo__text";
  logoText.textContent = t(props.locale, "menu.logo");

  logo.append(logoMark, logoText);

  const nav = document.createElement("nav");
  nav.className = "dab-menu__nav";
  nav.setAttribute("aria-label", t(props.locale, "menu.aria.nav"));

  MENU_NAV_ITEMS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dab-menu__nav-btn";
    button.dataset.tab = item.id;
    button.textContent = t(props.locale, item.labelKey);

    if (item.id === props.activeTab) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "page");
    }

    nav.appendChild(button);
  });

  const tools = document.createElement("div");
  tools.className = "dab-menu__tools";

  const currency = document.createElement("div");
  currency.className = "dab-currency";

  CURRENCY_ITEMS.forEach((item, index) => {
    const itemNode = document.createElement("div");
    itemNode.className = "dab-currency__item";
    itemNode.setAttribute("aria-label", t(props.locale, item.labelKey, { value: formatNumber(props.locale, item.value) }));

    const icon = document.createElement("span");
    icon.className = item.id === "coin"
      ? "dab-currency__icon dab-currency__icon--coin"
      : "dab-currency__icon dab-currency__icon--gem";
    icon.textContent = item.id === "coin" ? "M" : "◆";

    const value = document.createElement("span");
    value.className = "dab-currency__value";
    value.textContent = formatNumber(props.locale, item.value);

    itemNode.append(icon, value);
    currency.appendChild(itemNode);

    if (index < CURRENCY_ITEMS.length - 1) {
      const divider = document.createElement("span");
      divider.className = "dab-currency__divider";
      divider.setAttribute("aria-hidden", "true");
      currency.appendChild(divider);
    }
  });

  tools.append(currency);
  header.append(logo, nav, tools);
  container.appendChild(header);
}
