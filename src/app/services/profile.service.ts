// Responsável por regras de negócio do perfil persistido do jogador.
import { DEFAULT_CHAMPION_ID, isChampionId, isDefaultChampionId } from "@/shared/champions/champions.catalog";
import type { ChampionId } from "@/shared/champions/champion.model";
import { normalizeNickname, sanitizeChampionProgress, type UserProfile } from "../models/user.model";
import type { PlayerProgressRepository } from "../persistence/repositories/player-progress.repository";
import {
  createDefaultProfile,
  createPlayerProgressRepository
} from "../persistence/repositories/player-progress.repository";

function isChampionUnlocked(user: Pick<UserProfile, "champions">, championId: ChampionId): boolean {
  if (isDefaultChampionId(championId)) {
    return true;
  }

  return user.champions[championId]?.isUnlocked === true;
}

export type ProfileService = {
  hasUserProfile: () => boolean;
  getCurrentUser: () => UserProfile | null;
  ensureUserProfile: (nickname?: string) => UserProfile;
  registerUser: (nickname: string) => UserProfile;
  clearCurrentUser: () => void;
  selectChampion: (championId: ChampionId) => boolean;
  updateCurrentUser: (updater: (user: UserProfile) => UserProfile) => UserProfile | null;
  addCoins: (amount: number) => UserProfile | null;
};

export type ProfileServiceDependencies = {
  repository: PlayerProgressRepository;
};

export function createProfileService({
  repository
}: ProfileServiceDependencies = {
  repository: createPlayerProgressRepository()
}): ProfileService {
  const updateCurrentUser = (updater: (user: UserProfile) => UserProfile): UserProfile | null => {
    const currentUser = repository.loadProfile();
    if (!currentUser) {
      return null;
    }

    return repository.saveProfile(updater(currentUser));
  };

  return {
    hasUserProfile: () => repository.loadProfile() !== null,
    getCurrentUser: () => repository.loadProfile(),
    ensureUserProfile: (nickname) => {
      const existing = repository.loadProfile();
      if (existing) {
        return existing;
      }

      return repository.saveProfile(createDefaultProfile(nickname)) as UserProfile;
    },
    registerUser: (nickname) => {
      if (!normalizeNickname(nickname)) {
        throw new Error("Nickname inválido para criação de usuário.");
      }

      return repository.saveProfile(createDefaultProfile(nickname)) as UserProfile;
    },
    clearCurrentUser: () => {
      repository.clearProfile();
    },
    selectChampion: (championId) => {
      if (!isChampionId(championId)) {
        return false;
      }

      let didSelect = false;

      updateCurrentUser((user) => {
        if (!isChampionUnlocked(user, championId)) {
          return user;
        }

        didSelect = true;
        const now = new Date().toISOString();
        const selectedProgress =
          user.champions[championId] ??
          sanitizeChampionProgress(null, {
            isUnlockedDefault: isDefaultChampionId(championId)
          });

        return {
          ...user,
          selectedChampionId: championId,
          champions: {
            ...user.champions,
            [championId]: {
              ...selectedProgress,
              isUnlocked: selectedProgress.isUnlocked || isDefaultChampionId(championId),
              lastSelectedAt: now
            }
          }
        };
      });

      return didSelect;
    },
    updateCurrentUser,
    addCoins: (amount) => {
      const normalizedAmount = Number.isFinite(amount) ? Math.floor(amount) : 0;
      if (normalizedAmount <= 0) {
        return repository.loadProfile();
      }

      return updateCurrentUser((user) => ({
        ...user,
        coins: user.coins + normalizedAmount
      }));
    }
  };
}

export type UserService = ProfileService;
export type UserServiceDependencies = ProfileServiceDependencies;

export const createUserService = createProfileService;

const defaultProfileService = createProfileService();

export function ensureUserProfile(nickname?: string): UserProfile {
  return defaultProfileService.ensureUserProfile(nickname);
}

export function selectChampion(championId: ChampionId): void {
  defaultProfileService.selectChampion(championId);
}
