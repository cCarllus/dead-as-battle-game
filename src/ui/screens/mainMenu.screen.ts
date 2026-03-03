import template from "../layout/mainMenu.html?raw";
import { resolveLocale, t, type Locale } from "../../i18n";
import { clearElement, hydrateI18n, qs } from "../components/dom";
import {
  CURRENCY_ITEMS,
  DEFAULT_ACTIVE_TAB,
  FOOTER_ACTIONS,
  MENU_NAV_ITEMS,
  PLAY_PANEL_MODEL,
  TEAM_CAPACITY,
  TEAM_SLOTS,
  type MenuActionId,
  type MenuTabId
} from "./mainMenu.model";

export type MainMenuActions = {
  onOpenConfig: () => void;
  onOpenMultiplayer: () => void;
  onExit: () => void;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
};

const MENU_TAB_ID_SET = new Set<string>(MENU_NAV_ITEMS.map((item) => item.id));

function isMenuTabId(value: string | undefined): value is MenuTabId {
  return value !== undefined && MENU_TAB_ID_SET.has(value);
}

function isMenuActionId(value: string | undefined): value is MenuActionId {
  return value === "play" || value === "settings" || value === "exit";
}

function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function setActiveTab(menu: HTMLElement, activeTab: MenuTabId): void {
  menu.querySelectorAll<HTMLButtonElement>(".dab-menu__nav-btn[data-tab]").forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
      return;
    }

    button.removeAttribute("aria-current");
  });
}

function renderNavButtons(nav: HTMLElement, locale: Locale, activeTab: MenuTabId): void {
  nav.replaceChildren();

  MENU_NAV_ITEMS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dab-menu__nav-btn";
    button.dataset.tab = item.id;
    button.textContent = t(locale, item.labelKey);

    if (item.action) {
      button.dataset.action = item.action;
    }

    if (item.id === activeTab) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "page");
    }

    nav.appendChild(button);
  });
}

function renderCurrency(container: HTMLElement, locale: Locale): void {
  container.replaceChildren();

  CURRENCY_ITEMS.forEach((currency) => {
    const span = document.createElement("span");
    span.textContent = t(locale, currency.labelKey, {
      value: formatNumber(locale, currency.value)
    });
    container.appendChild(span);
  });
}

function renderTeamSlots(container: HTMLElement, locale: Locale): void {
  container.replaceChildren();

  TEAM_SLOTS.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";

    if (slot.type === "empty") {
      button.className = "dab-roster__slot dab-roster__slot--empty";
      button.setAttribute("aria-label", t(locale, slot.ariaLabelKey));
      button.textContent = "+";
      container.appendChild(button);
      return;
    }

    button.className = slot.isSelf ? "dab-roster__slot dab-roster__slot--self" : "dab-roster__slot";

    const status = document.createElement("span");
    status.className = slot.isOnline
      ? "dab-roster__status"
      : "dab-roster__status dab-roster__status--offline";

    const text = document.createElement("span");
    text.textContent = t(locale, slot.nameKey);

    const detail = document.createElement("small");
    detail.textContent = t(locale, slot.detailKey, slot.detailParams);
    text.appendChild(detail);

    button.append(status, text);
    container.appendChild(button);
  });
}

function renderFooterActions(container: HTMLElement, locale: Locale): void {
  container.replaceChildren();

  FOOTER_ACTIONS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dab-footer-button";
    button.dataset.action = item.action;
    button.textContent = t(locale, item.labelKey);
    container.appendChild(button);
  });
}

export function renderMainMenuScreen(root: HTMLElement, actions: MainMenuActions): () => void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);
  let activeTab = actions.activeTab ?? DEFAULT_ACTIVE_TAB;

  clearElement(root);
  root.innerHTML = template;

  const menu = qs<HTMLElement>(root, ".dab-menu");
  menu.setAttribute("aria-label", t(locale, "menu.aria.main"));
  hydrateI18n(menu, locale);

  const nav = qs<HTMLElement>(menu, '[data-slot="nav"]');
  nav.setAttribute("aria-label", t(locale, "menu.aria.nav"));
  renderNavButtons(nav, locale, activeTab);

  const currency = qs<HTMLElement>(menu, '[data-slot="currency"]');
  renderCurrency(currency, locale);

  const rosterCount = qs<HTMLElement>(menu, '[data-slot="roster-count"]');
  rosterCount.textContent = t(locale, "menu.roster.count", TEAM_CAPACITY);

  const teamSlots = qs<HTMLElement>(menu, '[data-slot="team-slots"]');
  renderTeamSlots(teamSlots, locale);

  const footerActions = qs<HTMLElement>(menu, '[data-slot="footer-actions"]');
  renderFooterActions(footerActions, locale);

  const playStatus = qs<HTMLElement>(menu, '[data-slot="ping"]');
  playStatus.textContent = t(locale, PLAY_PANEL_MODEL.pingKey, { value: PLAY_PANEL_MODEL.pingValue });

  const playSection = qs<HTMLElement>(menu, ".dab-play");
  playSection.setAttribute("aria-label", t(locale, "menu.aria.playModes"));

  const parallaxBackground = menu.querySelector<HTMLElement>('[data-parallax="bg"]');
  const parallaxHero = menu.querySelector<HTMLElement>('[data-parallax="hero"]');

  const actionHandlers: Record<MenuActionId, () => void> = {
    play: actions.onOpenMultiplayer,
    settings: actions.onOpenConfig,
    exit: actions.onExit
  };

  const abortController = new AbortController();
  const { signal } = abortController;

  menu.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("button");
      if (!button || !menu.contains(button)) {
        return;
      }

      const tab = button.dataset.tab;
      if (isMenuTabId(tab)) {
        activeTab = tab;
        setActiveTab(menu, activeTab);
        actions.onNavigateTab?.(activeTab);
      }

      const action = button.dataset.action;
      if (isMenuActionId(action)) {
        actionHandlers[action]();
      }
    },
    { signal }
  );

  menu.addEventListener(
    "pointermove",
    (event) => {
      const bounds = menu.getBoundingClientRect();
      const xRatio = (event.clientX - bounds.left) / bounds.width - 0.5;
      const yRatio = (event.clientY - bounds.top) / bounds.height - 0.5;

      if (parallaxBackground) {
        parallaxBackground.style.transform = `scale(1.06) translate(${xRatio * -16}px, ${yRatio * -12}px)`;
      }

      if (parallaxHero) {
        parallaxHero.style.transform = `translate(${xRatio * 18}px, ${yRatio * 12}px)`;
      }
    },
    { signal }
  );

  menu.addEventListener(
    "pointerleave",
    () => {
      if (parallaxBackground) {
        parallaxBackground.style.transform = "scale(1.06) translate(0, 0)";
      }

      if (parallaxHero) {
        parallaxHero.style.transform = "translate(0, 0)";
      }
    },
    { signal }
  );

  return () => abortController.abort();
}
