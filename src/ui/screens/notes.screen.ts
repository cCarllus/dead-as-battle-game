// Responsável por renderizar a tela de notes com navegação e detalhes expansíveis.
import type { Locale } from "../../i18n";
import template from "../layout/notes.html?raw";
import { bindDelegatedClick, qs } from "../components/dom";
import { renderNavbar } from "../components/navbar";
import { MENU_NAV_ITEMS, type MenuTabId } from "../navigation/menu.model";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

const MENU_TAB_ID_SET = new Set<string>(MENU_NAV_ITEMS.map((item) => item.id));

function isMenuTabId(value: string | undefined): value is MenuTabId {
  return value !== undefined && MENU_TAB_ID_SET.has(value);
}

function updateActiveTab(screen: HTMLElement, activeTab: MenuTabId): void {
  screen.querySelectorAll<HTMLButtonElement>(".dab-menu__nav-btn[data-tab]").forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
      return;
    }

    button.removeAttribute("aria-current");
  });
}

function setNoteExpanded(screen: HTMLElement, noteId: string, expanded: boolean): void {
  const details = screen.querySelector<HTMLElement>(`[data-note-details="${noteId}"]`);
  if (!details) {
    return;
  }

  const trigger = screen.querySelector<HTMLButtonElement>(`button[data-note-id="${noteId}"]`);
  const card = details.closest<HTMLElement>("[data-note-card]");
  details.hidden = !expanded;
  trigger?.setAttribute("aria-expanded", String(expanded));
  card?.classList.toggle("is-open", expanded);
}

export type NotesActions = {
  locale?: Locale;
  activeTab?: MenuTabId;
  coins?: number;
  onNavigateTab?: (tab: MenuTabId) => void;
};

export function renderNotesScreen(root: HTMLElement, actions: NotesActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  let activeTab = actions.activeTab ?? "notes";
  const screen = renderScreenTemplate(root, template, '[data-screen="notes"]', locale);

  const navbar = qs<HTMLElement>(screen, '[data-slot="navbar"]');
  renderNavbar(navbar, { locale, activeTab, coins: actions.coins });

  return bindDelegatedClick(screen, "button", (button) => {
    const tab = button.dataset.tab;
    if (isMenuTabId(tab)) {
      activeTab = tab;
      updateActiveTab(screen, activeTab);
      actions.onNavigateTab?.(tab);
      return;
    }

    const action = button.dataset.action;
    if (action !== "toggle-note") {
      return;
    }

    const noteId = button.dataset.noteId;
    if (!noteId) {
      return;
    }

    const expanded = button.getAttribute("aria-expanded") === "true";
    setNoteExpanded(screen, noteId, !expanded);
  });
}
