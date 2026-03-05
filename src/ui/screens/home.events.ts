// Responsável por registrar interações de navegação e efeitos de ponteiro da tela Home.
import { bind, bindDelegatedClick } from "../components/dom";
import { MENU_NAV_ITEMS, type MenuTabId } from "../navigation/menu.model";
import { isMenuActionId, type MenuActionId } from "./home.model";

const MENU_TAB_ID_SET = new Set<string>(MENU_NAV_ITEMS.map((item) => item.id));

function isMenuTabId(value: string | undefined): value is MenuTabId {
  return value !== undefined && MENU_TAB_ID_SET.has(value);
}

function updateActiveTab(menu: HTMLElement, activeTab: MenuTabId): void {
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

export type HomeEventsOptions = {
  menu: HTMLElement;
  initialActiveTab: MenuTabId;
  onTabChange?: (tab: MenuTabId) => void;
  onAction: (action: MenuActionId) => void;
};

export function bindHomeEvents(options: HomeEventsOptions): () => void {
  let activeTab = options.initialActiveTab;
  const parallaxBackground = options.menu.querySelector<HTMLElement>('[data-parallax="bg"]');

  const cleanups = [
    bindDelegatedClick(options.menu, "button", (button) => {
      const tab = button.dataset.tab;
      if (isMenuTabId(tab)) {
        activeTab = tab;
        updateActiveTab(options.menu, activeTab);
        options.onTabChange?.(activeTab);
      }

      const action = button.dataset.action;
      if (isMenuActionId(action)) {
        options.onAction(action);
      }
    }),
    bind(options.menu, "pointermove", (event) => {
      if (!parallaxBackground) {
        return;
      }

      const bounds = options.menu.getBoundingClientRect();
      const xRatio = (event.clientX - bounds.left) / bounds.width - 0.5;
      const yRatio = (event.clientY - bounds.top) / bounds.height - 0.5;

      parallaxBackground.style.transform = `scale(1.06) translate(${xRatio * -16}px, ${yRatio * -12}px)`;
    }),
    bind(options.menu, "pointerleave", () => {
      if (!parallaxBackground) {
        return;
      }

      parallaxBackground.style.transform = "scale(1.06) translate(0, 0)";
    })
  ];

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}
