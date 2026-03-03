import { resolveLocale, t, type Locale } from "./i18n";
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
} from "./menu.model";
import { clearElement } from "./utils/ui";

export type MenuActions = {
  onOpenConfig: () => void;
  onOpenMultiplayer: () => void;
  onExit: () => void;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
};

type MenuRoot = HTMLElement & { __menuCleanup?: () => void };
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

function renderNavButtons(locale: Locale, activeTab: MenuTabId): string {
  return MENU_NAV_ITEMS.map((item) => {
    const isActive = item.id === activeTab;
    const activeClass = isActive ? " is-active" : "";
    const activeAttribute = isActive ? ' aria-current="page"' : "";
    const actionAttribute = item.action ? ` data-action="${item.action}"` : "";

    return `<button type="button" class="dab-menu__nav-btn${activeClass}" data-tab="${item.id}"${actionAttribute}${activeAttribute}>${t(locale, item.labelKey)}</button>`;
  }).join("");
}

function renderCurrency(locale: Locale): string {
  return CURRENCY_ITEMS.map((currency) => {
    const value = formatNumber(locale, currency.value);
    return `<span>${t(locale, currency.labelKey, { value })}</span>`;
  }).join("");
}

function renderTeamSlots(locale: Locale): string {
  return TEAM_SLOTS.map((slot) => {
    if (slot.type === "empty") {
      return `<button type="button" class="dab-roster__slot dab-roster__slot--empty" aria-label="${t(locale, slot.ariaLabelKey)}">+</button>`;
    }

    const slotClasses = slot.isSelf ? "dab-roster__slot dab-roster__slot--self" : "dab-roster__slot";
    const statusClass = slot.isOnline
      ? "dab-roster__status"
      : "dab-roster__status dab-roster__status--offline";
    const detail = t(locale, slot.detailKey, slot.detailParams);
    const playerName = t(locale, slot.nameKey);

    return `<button type="button" class="${slotClasses}"><span class="${statusClass}"></span><span>${playerName} <small>${detail}</small></span></button>`;
  }).join("");
}

function renderFooterActions(locale: Locale): string {
  return FOOTER_ACTIONS.map((item) => {
    return `<button type="button" class="dab-footer-button" data-action="${item.action}">${t(locale, item.labelKey)}</button>`;
  }).join("");
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

export function renderMenu(root: HTMLElement, actions: MenuActions): void {
  const menuRoot = root as MenuRoot;
  menuRoot.__menuCleanup?.();

  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);
  let activeTab = actions.activeTab ?? DEFAULT_ACTIVE_TAB;
  const rosterCountLabel = t(locale, "menu.roster.count", TEAM_CAPACITY);

  clearElement(root);
  root.innerHTML = `
    <section class="dab-menu" aria-label="${t(locale, "menu.aria.main")}">
      <div class="dab-menu__bg" data-parallax="bg"></div>
      <div class="dab-menu__aurora dab-menu__aurora--left"></div>
      <div class="dab-menu__aurora dab-menu__aurora--right"></div>

      <header class="dab-menu__header">
        <div class="dab-logo">
          <span class="dab-logo__mark" aria-hidden="true"></span>
          <span class="dab-logo__text">${t(locale, "menu.logo").replace(".", "")}<span>.</span></span>
        </div>

        <nav class="dab-menu__nav" aria-label="${t(locale, "menu.aria.nav")}">
          ${renderNavButtons(locale, activeTab)}
        </nav>

        <div class="dab-menu__tools">
          <button type="button" class="dab-icon-button" data-action="settings" aria-label="${t(locale, "menu.tools.settingsAria")}">
            &#9881;
          </button>
          <div class="dab-currency">
            ${renderCurrency(locale)}
          </div>
          <div class="dab-avatar" aria-hidden="true">FX</div>
        </div>
      </header>

      <div class="dab-menu__watermark" aria-hidden="true">
        <h1>${t(locale, "menu.watermark.title")}</h1>
        <p>${t(locale, "menu.watermark.subtitle")}</p>
      </div>

      <div class="dab-menu__hero" data-parallax="hero" aria-hidden="true">
        <div class="dab-menu__hero-core"></div>
      </div>

      <main class="dab-menu__main">
        <aside class="dab-roster" aria-label="${t(locale, "menu.roster.title")}">
          <div class="dab-roster__title">
            <h2>${t(locale, "menu.roster.title")}</h2>
            <span>${rosterCountLabel}</span>
          </div>
          ${renderTeamSlots(locale)}
        </aside>

        <section class="dab-play" aria-label="${t(locale, "menu.aria.playModes")}">

          <article class="dab-play__card">
            <div class="dab-play__mode">
              <h3>${t(locale, PLAY_PANEL_MODEL.quickMatchKey)}</h3>
            </div>
            <button type="button" class="dab-play__start" data-action="play">${t(locale, PLAY_PANEL_MODEL.startKey)}</button>
          </article>

          <div class="dab-play__status">${t(locale, PLAY_PANEL_MODEL.pingKey, { value: PLAY_PANEL_MODEL.pingValue })}</div>
        </section>
      </main>

      <footer class="dab-menu__footer">
        <button type="button" class="dab-chat-button">${t(locale, "menu.footer.chat")}</button>
        <div class="dab-footer-actions">
          ${renderFooterActions(locale)}
        </div>
      </footer>
    </section>
  `;

  const menu = root.querySelector<HTMLElement>(".dab-menu");
  if (!menu) {
    return;
  }

  const abortController = new AbortController();
  const { signal } = abortController;
  const actionHandlers: Record<MenuActionId, () => void> = {
    play: actions.onOpenMultiplayer,
    settings: actions.onOpenConfig,
    exit: actions.onExit
  };

  const parallaxBackground = menu.querySelector<HTMLElement>('[data-parallax="bg"]');
  const parallaxHero = menu.querySelector<HTMLElement>('[data-parallax="hero"]');

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

  menuRoot.__menuCleanup = () => {
    abortController.abort();
    delete menuRoot.__menuCleanup;
  };
}
