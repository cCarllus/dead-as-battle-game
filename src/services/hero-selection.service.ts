// Responsável por validar seleção de herói e aplicar fallback seguro para o herói padrão.
import {
  DEFAULT_CHAMPION_ID,
  isChampionId,
  isDefaultChampionId
} from "../data/champions.catalog";
import type { ChampionId } from "../models/champion.model";
import type { UserProfile } from "../models/user.model";
import type { UserService } from "./user.service";

export type HeroSelectionStatus = "selected" | "locked" | "invalid_hero" | "no_user";

export type HeroSelectionResult = {
  status: HeroSelectionStatus;
  selectedHeroId: ChampionId | null;
  user: UserProfile | null;
};

export type HeroSelectionService = {
  canSelectHero: (user: UserProfile, heroId: ChampionId) => boolean;
  setSelectedHero: (heroId: ChampionId) => HeroSelectionResult;
  ensureSelectedHeroUnlocked: () => UserProfile | null;
  resolveSafeSelectedHeroId: (user: UserProfile) => ChampionId;
};

export type HeroSelectionServiceDependencies = {
  userService: UserService;
};

function isHeroUnlocked(user: UserProfile, heroId: ChampionId): boolean {
  if (isDefaultChampionId(heroId)) {
    return true;
  }

  return user.champions[heroId]?.isUnlocked === true;
}

function resolveSafeHeroId(user: UserProfile): ChampionId {
  if (!isChampionId(user.selectedChampionId)) {
    return DEFAULT_CHAMPION_ID;
  }

  if (!isHeroUnlocked(user, user.selectedChampionId)) {
    return DEFAULT_CHAMPION_ID;
  }

  return user.selectedChampionId;
}

export function createHeroSelectionService({
  userService
}: HeroSelectionServiceDependencies): HeroSelectionService {
  return {
    canSelectHero: (user, heroId) => {
      return isHeroUnlocked(user, heroId);
    },
    setSelectedHero: (heroId) => {
      const user = userService.getCurrentUser();
      if (!user) {
        return {
          status: "no_user",
          selectedHeroId: null,
          user: null
        };
      }

      if (!isChampionId(heroId)) {
        return {
          status: "invalid_hero",
          selectedHeroId: DEFAULT_CHAMPION_ID,
          user
        };
      }

      if (!isHeroUnlocked(user, heroId)) {
        return {
          status: "locked",
          selectedHeroId: resolveSafeHeroId(user),
          user
        };
      }

      const didSelect = userService.selectChampion(heroId);
      const updatedUser = userService.getCurrentUser();

      if (!didSelect || !updatedUser) {
        return {
          status: "locked",
          selectedHeroId: resolveSafeHeroId(user),
          user
        };
      }

      return {
        status: "selected",
        selectedHeroId: updatedUser.selectedChampionId,
        user: updatedUser
      };
    },
    ensureSelectedHeroUnlocked: () => {
      const user = userService.getCurrentUser();
      if (!user) {
        return null;
      }

      const safeHeroId = resolveSafeHeroId(user);
      if (user.selectedChampionId === safeHeroId) {
        return user;
      }

      const updatedUser = userService.updateCurrentUser((currentUser) => {
        return {
          ...currentUser,
          selectedChampionId: safeHeroId
        };
      });

      return updatedUser ?? userService.getCurrentUser();
    },
    resolveSafeSelectedHeroId: (user) => {
      return resolveSafeHeroId(user);
    }
  };
}
