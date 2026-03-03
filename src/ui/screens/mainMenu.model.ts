import type { TranslationKey, TranslationParams } from "../../i18n";

export type MenuTabId = "home" | "play" | "notes" | "heroes" | "store";
export type MenuActionId = "play" | "settings" | "exit";

export type MenuNavItem = {
  id: MenuTabId;
  labelKey: TranslationKey;
  action?: MenuActionId;
};

export const MENU_NAV_ITEMS: readonly MenuNavItem[] = [
  { id: "home", labelKey: "menu.nav.home" },
  { id: "play", labelKey: "menu.nav.play" },
  { id: "notes", labelKey: "menu.nav.notes" },
  { id: "heroes", labelKey: "menu.nav.heroes" },
  { id: "store", labelKey: "menu.nav.store" }
];

export const DEFAULT_ACTIVE_TAB: MenuTabId = "home";

export type CurrencyItem = {
  id: "coin" | "gem";
  labelKey: TranslationKey;
  value: number;
};

export const CURRENCY_ITEMS: readonly CurrencyItem[] = [
  { id: "coin", labelKey: "menu.currency.coin", value: 1250 },
  { id: "gem", labelKey: "menu.currency.gem", value: 45 }
];

export type PlayerTeamSlot = {
  type: "player";
  nameKey: TranslationKey;
  detailKey: TranslationKey;
  detailParams?: TranslationParams;
  isSelf?: boolean;
  isOnline?: boolean;
};

export type EmptyTeamSlot = {
  type: "empty";
  ariaLabelKey: TranslationKey;
};

export type TeamSlot = PlayerTeamSlot | EmptyTeamSlot;

export const TEAM_CAPACITY = {
  current: 1,
  total: 3
} as const;

export const TEAM_SLOTS: readonly TeamSlot[] = [
  {
    type: "player",
    nameKey: "menu.team.player1",
    detailKey: "menu.roster.level",
    detailParams: { value: 42 },
    isSelf: true,
    isOnline: true
  },
  { type: "empty", ariaLabelKey: "menu.roster.inviteAria" },
  { type: "empty", ariaLabelKey: "menu.roster.inviteAria" }
];

export const PLAY_PANEL_MODEL = {
  pingKey: "menu.play.ping",
  pingValue: 24
} as const;

export type FooterAction = {
  labelKey: TranslationKey;
  action: MenuActionId;
};

export const FOOTER_ACTIONS: readonly FooterAction[] = [
  { labelKey: "menu.footer.settings", action: "settings" },
  { labelKey: "menu.footer.back", action: "exit" }
];
