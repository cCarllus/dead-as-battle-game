// Responsável por resolver catálogo de campeões para um usuário e dados de exibição.
import {
  getBaseChampionById,
  getChampionCatalogForUser,
  isChampionId,
  isDefaultChampionId,
  DEFAULT_CHAMPION_ID
} from "../data/champions.catalog";
import type { ChampionCatalogItem, ChampionId } from "../models/champion.model";
import type { UserProfile } from "../models/user.model";

export type ChampionWithProgress = ChampionCatalogItem & {
  level: number;
  isUnlocked: boolean;
};

export function getChampionDisplayName(user: UserProfile, champion: ChampionCatalogItem): string {
  if (champion.isDefault) {
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

export function isChampionUnlockedForUser(user: UserProfile, championId: ChampionId): boolean {
  if (isDefaultChampionId(championId)) {
    return true;
  }

  return user.champions[championId]?.isUnlocked === true;
}

function resolveSafeChampionId(user: UserProfile, championId: ChampionId): ChampionId {
  if (isChampionUnlockedForUser(user, championId)) {
    return championId;
  }

  return DEFAULT_CHAMPION_ID;
}

export function getSelectedChampionForUser(user: UserProfile): ChampionCatalogItem {
  const selectedId = isChampionId(user.selectedChampionId) ? user.selectedChampionId : DEFAULT_CHAMPION_ID;
  const safeSelectedId = resolveSafeChampionId(user, selectedId);
  return getChampionForUser(user, safeSelectedId);
}

function resolveChampionLevel(user: UserProfile, championId: ChampionId): number {
  return user.champions[championId]?.level ?? 1;
}

function resolveChampionUnlockedState(user: UserProfile, champion: ChampionCatalogItem): boolean {
  if (champion.isDefault) {
    return true;
  }

  return user.champions[champion.id]?.isUnlocked === true;
}

export function getChampionCardsForUser(user: UserProfile): readonly ChampionWithProgress[] {
  return getChampionsForUser(user).map((champion) => {
    return {
      ...champion,
      displayName: getChampionDisplayName(user, champion),
      level: resolveChampionLevel(user, champion.id),
      isUnlocked: resolveChampionUnlockedState(user, champion)
    };
  });
}
