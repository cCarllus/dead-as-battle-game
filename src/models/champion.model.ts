// Responsável por tipar o catálogo de campeões e seus metadados visuais.
export type ChampionId = "sukuna" | "steve" | "finn" | "subzero";

export type ChampionCatalogItem = {
  id: ChampionId;
  displayName: string;
  universeName: string;
  modelUrl: string;
  cardImageUrl: string;
  splashImageUrl: string;
  themeColor: `#${string}`;
};
