// Responsável por centralizar catálogo base de campeões e utilitários de resolução.
import type { ChampionCatalogItem, ChampionId } from "../models/champion.model";

export const CHAMPION_IDS: readonly ChampionId[] = ["user", "sukuna", "kaiju_no_8"];

const DEFAULT_USER_CHAMPION_THEME = "#850404af" as const;

export const DEFAULT_CHAMPION_ID: ChampionId = "user";

export const USER_CHAMPION_TEMPLATE: ChampionCatalogItem = {
  id: "user",
  displayName: "Player",
  priceCoins: 0,
  isDefault: true,
  universeName: "Dead as Battle",
  modelUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/models/champions/default/default_champion_reloaded.glb",
  cardImageUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/images/champions/default/default_champ_card.png",
  splashImageUrl: "https://imgs.search.brave.com/aenZAYJGTuXL89r7XCaO2E788nw3F7osgmTKkUj5-2Y/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pMS5z/bmRjZG4uY29tL2Fy/dHdvcmtzLWl5VXZT/UDVvSDBPQS0wLXQx/MDgweDEwODAuanBn",
  selectAudioUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/sounds/champions/default/default_audio_lobby.mp3",
  themeColor: DEFAULT_USER_CHAMPION_THEME
};

export const UNIVERSE_CHAMPION_CATALOG: readonly ChampionCatalogItem[] = [
  {
    id: "sukuna",
    displayName: "Ryomen Sukuna",
    priceCoins: 1000,
    isDefault: false,
    universeName: "Jujutsu Kaisen",
    modelUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/models/champions/sukuna/sukuna.glb",
    cardImageUrl: "https://imgs.search.brave.com/4xKnueO8sbGhJzX-a3xpjeXEV_9S-XH6Aa2iVyP_83Q/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4u/d2FsbHBhcGVyc2Fm/YXJpLmNvbS84NC84/L1ptdXM1Ny5qcGc",
    splashImageUrl: "https://wallpapercave.com/wp/wp9146052.jpg",
    selectAudioUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/sounds/champions/sukuna/sukuna_audio_lobby.mp3",
    themeColor: "#fa1515"
  },
  {
    id: "kaiju_no_8",
    displayName: "Kaiju No. 8",
    priceCoins: 600,
    isDefault: false,
    universeName: "Kaiju No. 8",
    modelUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/models/champions/kaiju_no_8/kaiju_no_8.glb",
    cardImageUrl: "https://imgs.search.brave.com/DqGG85r2no3aQUCEDlwL4NeHAzcqujcGyRDSlT1xZI4/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vdmlk/ZW9zL3RodW1ibmFp/bHMvb3JpZ2luYWxz/LzIzLzNmLzlhLzIz/M2Y5YTVjNDJhZWJk/OGE4NmRiYzdlZTNh/YWIwNjA4LjAwMDAw/MDAuanBn",
    splashImageUrl: "https://imgs.search.brave.com/pFl7v2bGLXWoylvyxLS44rNt1vvB1UG8o3rU1eD1VZ8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93YWxs/cGFwZXJzLmNvbS9p/bWFnZXMvZmVhdHVy/ZWQva2FpanUtbm8t/OC1tcHZ3d2F0NG5z/dGEwNGtsLmpwZw",
    selectAudioUrl: "https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/sounds/champions/kaiju_no_8/kaiju_no_8_audio_lobby.mp3",
    themeColor: "#012bfb"
  },
] as const;

function normalizeNickname(nickname: string): string {
  const normalized = nickname.trim();
  return normalized.length > 0 ? normalized : "Player";
}

export function createUserChampionEntry(nickname: string): ChampionCatalogItem {
  return {
    ...USER_CHAMPION_TEMPLATE,
    displayName: normalizeNickname(nickname),
    themeColor: DEFAULT_USER_CHAMPION_THEME
  };
}

export function getChampionCatalogForUser(nickname: string): readonly ChampionCatalogItem[] {
  return [createUserChampionEntry(nickname), ...UNIVERSE_CHAMPION_CATALOG];
}

export function isChampionId(value: string | undefined): value is ChampionId {
  return value !== undefined && CHAMPION_IDS.some((championId) => championId === value);
}

export function getBaseChampionById(championId: ChampionId): ChampionCatalogItem {
  if (championId === "user") {
    return USER_CHAMPION_TEMPLATE;
  }

  const resolvedChampion = UNIVERSE_CHAMPION_CATALOG.find((champion) => champion.id === championId);
  return resolvedChampion ?? USER_CHAMPION_TEMPLATE;
}

export function isDefaultChampionId(championId: ChampionId): boolean {
  return getBaseChampionById(championId).isDefault;
}

export function getChampionPriceCoins(championId: ChampionId): number {
  return getBaseChampionById(championId).priceCoins;
}
