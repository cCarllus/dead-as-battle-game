// Responsável por tipar catálogo e metadados de campeões.
export type ChampionId = "default_champion";

export type ChampionPreviewAnimation = {
  assetUrl?: string | null;
  groupName?: string | null;
  loop?: boolean;
};

export type ChampionCatalogItem = {
  id: ChampionId;
  displayName: string;
  priceCoins: number;
  isDefault: boolean;
  universeName: string;
  modelUrl: string | null;
  animationOverrideBaseUrl?: string | null;
  previewAnimation?: ChampionPreviewAnimation | null;
  cardImageUrl: string;
  splashImageUrl: string;
  selectAudioUrl: string;
  themeColor: `#${string}`;
};
