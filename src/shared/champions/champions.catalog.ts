// Responsável por centralizar catálogo base de campeões e utilitários de resolução.
import type { ChampionCatalogItem, ChampionId } from "./champion.model";
import { HERO_MODEL_ASSET_URLS } from "@/shared/assets/game-assets";

export const CHAMPION_IDS: readonly ChampionId[] = ["default_champion"];

const DEFAULT_CHAMPION_THEME = "#850404af" as const;

export const DEFAULT_CHAMPION_ID: ChampionId = "default_champion";

export const DEFAULT_CHAMPION_TEMPLATE: ChampionCatalogItem = {
  id: "default_champion",
  displayName: "Default Champion",
  priceCoins: 0,
  isDefault: true,
  universeName: "Dead as Battleground",
  modelUrl: HERO_MODEL_ASSET_URLS.defaultChampion.default,
  animationOverrideBaseUrl: null,
  previewAnimation: null,
  cardImageUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/images/champions/default/default_champ_card.png",
  splashImageUrl: "https://imgs.search.brave.com/aenZAYJGTuXL89r7XCaO2E788nw3F7osgmTKkUj5-2Y/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pMS5z/bmRjZG4uY29tL2Fy/dHdvcmtzLWl5VXZT/UDVvSDBPQS0wLXQx/MDgweDEwODAuanBn",
  selectAudioUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/sounds/champions/default/default_audio_lobby.mp3",
  themeColor: DEFAULT_CHAMPION_THEME
};

function normalizeNickname(nickname: string): string {
  const normalized = nickname.trim();
  return normalized.length > 0 ? normalized : "Player";
}

export function createDefaultChampionEntry(nickname: string): ChampionCatalogItem {
  return {
    ...DEFAULT_CHAMPION_TEMPLATE,
    displayName: normalizeNickname(nickname),
    themeColor: DEFAULT_CHAMPION_THEME
  };
}

export function getChampionCatalogForUser(nickname: string): readonly ChampionCatalogItem[] {
  return [createDefaultChampionEntry(nickname)];
}

export function isChampionId(value: string | undefined): value is ChampionId {
  return value !== undefined && CHAMPION_IDS.some((championId) => championId === value);
}

export function getBaseChampionById(championId: ChampionId): ChampionCatalogItem {
  return championId === DEFAULT_CHAMPION_ID ? DEFAULT_CHAMPION_TEMPLATE : DEFAULT_CHAMPION_TEMPLATE;
}

export function isDefaultChampionId(championId: ChampionId): boolean {
  return getBaseChampionById(championId).isDefault;
}

export function getChampionPriceCoins(championId: ChampionId): number {
  return getBaseChampionById(championId).priceCoins;
}
