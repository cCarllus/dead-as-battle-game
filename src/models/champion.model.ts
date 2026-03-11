// Responsável por tipar catálogo e metadados de campeões.
export type ChampionId = "default_champion";

export type ChampionCatalogItem = {
  id: ChampionId;
  displayName: string;
  priceCoins: number;
  isDefault: boolean;
  universeName: string;
  modelUrl: string | null;
  animationOverrideBaseUrl?: string | null;
  cardImageUrl: string;
  splashImageUrl: string;
  selectAudioUrl: string;
  themeColor: `#${string}`;
};
