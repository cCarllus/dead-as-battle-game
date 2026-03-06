// Responsável por tipar catálogo e metadados de campeões.
export type ChampionId = "user" | "sukuna" | "kaiju_no_8";

export type ChampionCatalogItem = {
  id: ChampionId;
  displayName: string;
  priceCoins: number;
  isDefault: boolean;
  universeName: string;
  modelUrl: string | null;
  cardImageUrl: string;
  splashImageUrl: string;
  selectAudioUrl: string;
  themeColor: `#${string}`;
};
