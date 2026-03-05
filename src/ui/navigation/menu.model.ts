// Responsável por centralizar configuração de abas de navegação do menu principal.
import type { TranslationKey } from "../../i18n";

export type MenuTabId = "home" | "champions" | "store" | "notes";

export type MenuNavItem = {
  id: MenuTabId;
  labelKey: TranslationKey;
};

export const MENU_NAV_ITEMS: readonly MenuNavItem[] = [
  { id: "home", labelKey: "menu.nav.home" },
  { id: "champions", labelKey: "menu.nav.champions" },
  { id: "notes", labelKey: "menu.nav.notes" },
  { id: "store", labelKey: "menu.nav.store" }
];

export const DEFAULT_ACTIVE_TAB: MenuTabId = "home";
