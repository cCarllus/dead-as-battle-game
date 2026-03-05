// Responsável por resolver catálogo de campeões para um usuário e dados de exibição.
import {
  getBaseChampionById,
  getChampionCatalogForUser,
  isChampionId,
  DEFAULT_CHAMPION_ID
} from "../data/champions.catalog";
import type { ChampionCatalogItem, ChampionId } from "../models/champion.model";
import type { UserProfile } from "../models/user.model";

export type ChampionWithProgress = ChampionCatalogItem & {
  level: number;
};

export function getChampionDisplayName(user: UserProfile, champion: ChampionCatalogItem): string {
  if (champion.id === "user") {
    return user.nickname;
  }

  return champion.displayName;
}

export function getChampionsForUser(user: UserProfile): readonly ChampionCatalogItem[] {
  return getChampionCatalogForUser(user.nickname);
}

export function getChampionForUser(user: UserProfile, championId: ChampionId): ChampionCatalogItem {
  const catalog = getChampionsForUser(user);
  const foundChampion = catalog.find((champion) => champion.id === championId);
  if (foundChampion) {
    return foundChampion;
  }

  return catalog[0] ?? getBaseChampionById(DEFAULT_CHAMPION_ID);
}

export function getSelectedChampionForUser(user: UserProfile): ChampionCatalogItem {
  const selectedId = isChampionId(user.selectedChampionId) ? user.selectedChampionId : DEFAULT_CHAMPION_ID;
  return getChampionForUser(user, selectedId);
}

export function getChampionCardsForUser(user: UserProfile): readonly ChampionWithProgress[] {
  return getChampionsForUser(user).map((champion) => {
    const progress = user.champions[champion.id];

    return {
      ...champion,
      displayName: getChampionDisplayName(user, champion),
      level: progress?.level ?? 1
    };
  });
}
