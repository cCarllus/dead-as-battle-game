// Responsável por definir modelos e dados estáticos usados pela tela Home.
import type { TranslationKey, TranslationParams } from "../../i18n";

export const MENU_ACTION_IDS = ["play", "champions", "settings", "exit"] as const;
export type MenuActionId = (typeof MENU_ACTION_IDS)[number];

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
  name: string;
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

export const TEAM_TOTAL_SLOTS = 3;

export function createTeamSlots(params: {
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  isOnline: boolean;
}): readonly TeamSlot[] {
  return [
    {
      type: "player",
      name: params.playerName,
      detailKey: "home.currentChampionShort",
      detailParams: {
        champion: params.selectedChampionName,
        level: params.selectedChampionLevel
      },
      isSelf: true,
      isOnline: params.isOnline
    },
    { type: "empty", ariaLabelKey: "menu.roster.inviteAria" },
    { type: "empty", ariaLabelKey: "menu.roster.inviteAria" }
  ];
}

export type FooterAction = {
  labelKey: TranslationKey;
  action: MenuActionId;
};

export const FOOTER_ACTIONS: readonly FooterAction[] = [
  { labelKey: "menu.footer.champions", action: "champions" },
  { labelKey: "menu.footer.settings", action: "settings" },
  { labelKey: "common.back", action: "exit" }
];

export function isMenuActionId(value: string | undefined): value is MenuActionId {
  return value !== undefined && MENU_ACTION_IDS.some((actionId) => actionId === value);
}
