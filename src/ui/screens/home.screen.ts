import template from "../layout/home.html?raw";
import { resolveLocale, t, type Locale } from "../../i18n";
import { clearElement, hydrateI18n, qs } from "../components/dom";
import { mountChampionPreview } from "../components/champion-preview";
import { renderNavbar } from "../components/navbar";
import {
  DEFAULT_ACTIVE_TAB,
  MENU_NAV_ITEMS,
  type MenuTabId
} from "../navigation/menu.model";
import {
  createTeamSlots,
  FOOTER_ACTIONS,
  TEAM_TOTAL_SLOTS,
  type MenuActionId,
  type TeamSlot
} from "./home.model";

export type HomeActions = {
  onOpenConfig: () => void;
  onOpenMultiplayer: () => void;
  onExit: () => void;
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  playerName: string;
  playerLevel: number;
  isSessionActive: boolean;
};

const MENU_TAB_ID_SET = new Set<string>(MENU_NAV_ITEMS.map((item) => item.id));

function isMenuTabId(value: string | undefined): value is MenuTabId {
  return value !== undefined && MENU_TAB_ID_SET.has(value);
}

function isMenuActionId(value: string | undefined): value is MenuActionId {
  return value === "play" || value === "settings" || value === "exit";
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

function renderTeamSlots(container: HTMLElement, locale: Locale, slots: readonly TeamSlot[]): void {
  container.replaceChildren();

  slots.forEach((slot) => {
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
    text.textContent = slot.name;

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

export function renderHomeScreen(root: HTMLElement, actions: HomeActions): () => void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);
  let activeTab = actions.activeTab ?? DEFAULT_ACTIVE_TAB;

  const teamSlotsModel = createTeamSlots({
    playerName: actions.playerName,
    playerLevel: actions.playerLevel,
    isOnline: actions.isSessionActive
  });
  const currentPlayers = teamSlotsModel.filter((slot) => slot.type === "player").length;

  clearElement(root);
  root.innerHTML = template;

  const menu = qs<HTMLElement>(root, ".dab-menu");
  menu.setAttribute("aria-label", t(locale, "menu.aria.main"));
  hydrateI18n(menu, locale);

  const navbar = qs<HTMLElement>(menu, '[data-slot="navbar"]');
  renderNavbar(navbar, {
    locale,
    activeTab
  });

  const rosterCount = qs<HTMLElement>(menu, '[data-slot="roster-count"]');
  rosterCount.textContent = t(locale, "menu.roster.count", {
    current: currentPlayers,
    total: TEAM_TOTAL_SLOTS
  });

  const teamSlots = qs<HTMLElement>(menu, '[data-slot="team-slots"]');
  renderTeamSlots(teamSlots, locale, teamSlotsModel);

  const footerActions = qs<HTMLElement>(menu, '[data-slot="footer-actions"]');
  renderFooterActions(footerActions, locale);

  const playSection = qs<HTMLElement>(menu, ".dab-play");
  playSection.setAttribute("aria-label", t(locale, "menu.aria.playModes"));

  const championPreview = qs<HTMLElement>(menu, "#champion-preview");
  const disposeChampionPreview = mountChampionPreview(championPreview, {
    modelUrl: "/assets/models/characters/ryomen_sukuna/ryomen_sukuna.glb"
  });

  const parallaxBackground = menu.querySelector<HTMLElement>('[data-parallax="bg"]');
  const parallaxChampion = menu.querySelector<HTMLElement>('[data-parallax="champion"]');

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

      if (parallaxChampion) {
        parallaxChampion.style.setProperty("--champion-parallax-x", `${xRatio * 18}px`);
        parallaxChampion.style.setProperty("--champion-parallax-y", `${yRatio * 12}px`);
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

      if (parallaxChampion) {
        parallaxChampion.style.setProperty("--champion-parallax-x", "0px");
        parallaxChampion.style.setProperty("--champion-parallax-y", "0px");
      }
    },
    { signal }
  );

  return () => {
    abortController.abort();
    disposeChampionPreview();
  };
}
