// Responsável por validar e executar compra de heróis usando moedas do perfil local do usuário.
import {
  getBaseChampionById,
  getChampionPriceCoins,
  isChampionId,
  isDefaultChampionId
} from "@/shared/champions/champions.catalog";
import type { ChampionId } from "@/shared/champions/champion.model";
import { sanitizeChampionProgress, type UserProfile } from "../models/user.model";
import type { NotificationService } from "./notification.service";
import type { UserService } from "./user.service";

export type HeroUnlockStatus =
  | "unlocked"
  | "already_unlocked"
  | "insufficient_coins"
  | "invalid_hero"
  | "default_hero"
  | "no_user";

export type HeroUnlockResult = {
  status: HeroUnlockStatus;
  heroId: ChampionId | null;
  user: UserProfile | null;
  priceCoins: number;
};

export type HeroPurchaseService = {
  canUnlockHero: (user: UserProfile, heroId: ChampionId) => boolean;
  unlockHero: (heroId: ChampionId) => HeroUnlockResult;
};

export type HeroPurchaseServiceDependencies = {
  userService: UserService;
  notificationService: NotificationService;
};

function isHeroUnlocked(user: UserProfile, heroId: ChampionId): boolean {
  if (isDefaultChampionId(heroId)) {
    return true;
  }

  return user.champions[heroId]?.isUnlocked === true;
}

export function canUnlockHero(user: UserProfile, heroId: ChampionId): boolean {
  if (isDefaultChampionId(heroId)) {
    return false;
  }

  if (isHeroUnlocked(user, heroId)) {
    return false;
  }

  return user.coins >= getChampionPriceCoins(heroId);
}

export function createHeroPurchaseService({
  userService,
  notificationService
}: HeroPurchaseServiceDependencies): HeroPurchaseService {
  return {
    canUnlockHero: (user, heroId) => canUnlockHero(user, heroId),
    unlockHero: (heroId) => {
      if (!isChampionId(heroId)) {
        return {
          status: "invalid_hero",
          heroId: null,
          user: userService.getCurrentUser(),
          priceCoins: 0
        };
      }

      const user = userService.getCurrentUser();
      if (!user) {
        return {
          status: "no_user",
          heroId,
          user: null,
          priceCoins: getChampionPriceCoins(heroId)
        };
      }

      const priceCoins = getChampionPriceCoins(heroId);

      if (isDefaultChampionId(heroId)) {
        return {
          status: "default_hero",
          heroId,
          user,
          priceCoins
        };
      }

      if (isHeroUnlocked(user, heroId)) {
        return {
          status: "already_unlocked",
          heroId,
          user,
          priceCoins
        };
      }

      if (user.coins < priceCoins) {
        return {
          status: "insufficient_coins",
          heroId,
          user,
          priceCoins
        };
      }

      const updatedUser = userService.updateCurrentUser((currentUser) => {
        const currentProgress =
          currentUser.champions[heroId] ??
          sanitizeChampionProgress(null, {
            isUnlockedDefault: false
          });

        return {
          ...currentUser,
          coins: Math.max(0, currentUser.coins - priceCoins),
          champions: {
            ...currentUser.champions,
            [heroId]: {
              ...currentProgress,
              isUnlocked: true
            }
          }
        };
      });

      if (!updatedUser) {
        return {
          status: "no_user",
          heroId,
          user: null,
          priceCoins
        };
      }

      const hero = getBaseChampionById(heroId);
      notificationService.addNotification({
        type: "system",
        title: "Novo personagem desbloqueado",
        message: `Você desbloqueou ${hero.displayName}.`
      });

      return {
        status: "unlocked",
        heroId,
        user: updatedUser,
        priceCoins
      };
    }
  };
}
