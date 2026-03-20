// Responsável por centralizar configuração de abas de navegação do menu principal.
import type { TranslationKey } from "../i18n";
import type { MenuIconId } from "../components/menu-icon";

export type MenuTabId = "home" | "champions" | "store" | "notes";

export type MenuNavItem = {
  id: MenuTabId;
  labelKey: TranslationKey;
  iconId: MenuIconId;
};

export const MENU_NAV_ITEMS: readonly MenuNavItem[] = [
  { id: "home", labelKey: "menu.nav.home", iconId: "home" },
  { id: "champions", labelKey: "menu.nav.champions", iconId: "champions" },
  { id: "notes", labelKey: "menu.nav.notes", iconId: "notes" },
  { id: "store", labelKey: "menu.nav.store", iconId: "store" }
];

export const DEFAULT_ACTIVE_TAB: MenuTabId = "home";
