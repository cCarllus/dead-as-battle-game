// Responsável por fornecer o catálogo oficial de campeões usado em toda a aplicação.
import type { ChampionCatalogItem, ChampionId } from "../models/champion.model";

export const CHAMPION_CATALOG: readonly ChampionCatalogItem[] = [
  {
    id: "sukuna",
    displayName: "Ryomen Sukuna",
    universeName: "Jujutsu Kaisen",
    modelUrl: "assets/models/champions/sukuna/sukuna.glb",
    cardImageUrl:
      "https://imgs.search.brave.com/Tk0pRXX1wPQZTpY2HHHTOi2pgPye_7OTrIAVh9V6VKM/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93YWxs/cGFwZXJjYXZlLmNv/bS93cC93cDE1MDc1/NTc3LndlYnA",
    splashImageUrl:
      "https://wallpapercave.com/wp/wp9146052.jpg",
    themeColor: "#e40b0b"
  },
] as const;

export const CHAMPION_IDS = CHAMPION_CATALOG.map((champion) => champion.id) as readonly ChampionId[];

export const CHAMPION_CATALOG_BY_ID: Record<ChampionId, ChampionCatalogItem> = CHAMPION_CATALOG.reduce(
  (acc, champion) => {
    acc[champion.id] = champion;
    return acc;
  },
  {} as Record<ChampionId, ChampionCatalogItem>
);

export const DEFAULT_CHAMPION_ID: ChampionId = CHAMPION_CATALOG[0]?.id ?? "sukuna";

export function isChampionId(value: string | undefined): value is ChampionId {
  return value !== undefined && Object.prototype.hasOwnProperty.call(CHAMPION_CATALOG_BY_ID, value);
}

export function getChampionById(championId: ChampionId): ChampionCatalogItem {
  return CHAMPION_CATALOG_BY_ID[championId];
}
