// Responsável por controlar tempo ativo visível, geração de recompensas e resgate de moedas.
import {
  ACTIVE_REWARD_INTERVAL_SECONDS,
  COIN_REWARD_AMOUNT,
  MAX_PENDING_COIN_REWARDS,
  type RewardComputationResult
} from "../models/reward.model";
import type { UserProfile } from "../models/user.model";
import type { NotificationService } from "./notification.service";
import type { UserService } from "./user.service";

export type RewardAvailableEvent = {
  generatedRewards: number;
  pendingCoinRewards: number;
};

export type RewardService = {
  startActiveTracking: () => () => void;
  stopActiveTracking: () => void;
  incrementActivePlayTime: (deltaSeconds: number) => RewardComputationResult | null;
  generateRewardIfNeeded: () => RewardComputationResult | null;
  claimReward: () => UserProfile | null;
  getPendingCoinRewards: () => number;
  onRewardAvailable: (listener: (event: RewardAvailableEvent) => void) => () => void;
};

export type RewardServiceDependencies = {
  userService: UserService;
  notificationService: NotificationService;
};

function isDocumentVisible(): boolean {
  return typeof document !== "undefined" ? document.visibilityState === "visible" : true;
}

export function createRewardService({
  userService,
  notificationService
}: RewardServiceDependencies): RewardService {
  const rewardListeners = new Set<(event: RewardAvailableEvent) => void>();
  let trackingIntervalId: number | null = null;
  let trackingVisibilityCleanup: (() => void) | null = null;

  const emitRewardAvailable = (event: RewardAvailableEvent): void => {
    rewardListeners.forEach((listener) => {
      listener(event);
    });
  };

  const computeRewardState = (activePlayTimeSeconds: number, pendingCoinRewards: number): RewardComputationResult => {
    let active = activePlayTimeSeconds;
    let pending = pendingCoinRewards;
    let generatedRewards = 0;

    if (pending >= MAX_PENDING_COIN_REWARDS) {
      return {
        activePlayTimeSeconds: Math.min(active, ACTIVE_REWARD_INTERVAL_SECONDS - 1),
        pendingCoinRewards: MAX_PENDING_COIN_REWARDS,
        generatedRewards: 0
      };
    }

    while (active >= ACTIVE_REWARD_INTERVAL_SECONDS && pending < MAX_PENDING_COIN_REWARDS) {
      active -= ACTIVE_REWARD_INTERVAL_SECONDS;
      pending += 1;
      generatedRewards += 1;
    }

    if (pending >= MAX_PENDING_COIN_REWARDS) {
      active = Math.min(active, ACTIVE_REWARD_INTERVAL_SECONDS - 1);
    }

    return {
      activePlayTimeSeconds: active,
      pendingCoinRewards: pending,
      generatedRewards
    };
  };

  const incrementActivePlayTime = (deltaSeconds: number): RewardComputationResult | null => {
    const normalizedDelta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.floor(deltaSeconds)) : 0;
    const currentUser = userService.getCurrentUser();
    if (!currentUser) {
      return null;
    }

    const computation = computeRewardState(
      currentUser.activePlayTimeSeconds + normalizedDelta,
      currentUser.pendingCoinRewards
    );

    if (
      computation.activePlayTimeSeconds !== currentUser.activePlayTimeSeconds ||
      computation.pendingCoinRewards !== currentUser.pendingCoinRewards
    ) {
      userService.updateCurrentUser((user) => ({
        ...user,
        activePlayTimeSeconds: computation.activePlayTimeSeconds,
        pendingCoinRewards: computation.pendingCoinRewards
      }));
    }

    if (computation.generatedRewards > 0) {
      const rewardCoins = computation.generatedRewards * COIN_REWARD_AMOUNT;
      notificationService.addNotification({
        type: "reward",
        title: "Recompensa disponível",
        message:
          computation.generatedRewards === 1
            ? `Você pode resgatar ${COIN_REWARD_AMOUNT} coins por 10 minutos jogados.`
            : `Você pode resgatar ${rewardCoins} coins acumuladas por tempo jogado.`,
        actionType: "claim_reward"
      });

      emitRewardAvailable({
        generatedRewards: computation.generatedRewards,
        pendingCoinRewards: computation.pendingCoinRewards
      });
    }

    return computation;
  };

  const stopActiveTracking = (): void => {
    if (trackingIntervalId !== null) {
      window.clearInterval(trackingIntervalId);
      trackingIntervalId = null;
    }

    trackingVisibilityCleanup?.();
    trackingVisibilityCleanup = null;
  };

  return {
    startActiveTracking: () => {
      if (trackingIntervalId !== null) {
        return () => {
          stopActiveTracking();
        };
      }

      let lastTickAtMs = Date.now();
      let visibleRemainderMs = 0;

      const resetTickClock = (): void => {
        lastTickAtMs = Date.now();
      };

      document.addEventListener("visibilitychange", resetTickClock);
      trackingVisibilityCleanup = () => {
        document.removeEventListener("visibilitychange", resetTickClock);
      };

      trackingIntervalId = window.setInterval(() => {
        const nowMs = Date.now();
        const elapsedMs = Math.max(0, nowMs - lastTickAtMs);
        lastTickAtMs = nowMs;

        if (!isDocumentVisible()) {
          return;
        }

        visibleRemainderMs += elapsedMs;
        const deltaSeconds = Math.floor(visibleRemainderMs / 1000);
        if (deltaSeconds <= 0) {
          return;
        }

        visibleRemainderMs -= deltaSeconds * 1000;
        incrementActivePlayTime(deltaSeconds);
      }, 1000);

      return () => {
        stopActiveTracking();
      };
    },
    stopActiveTracking,
    incrementActivePlayTime,
    generateRewardIfNeeded: () => {
      return incrementActivePlayTime(0);
    },
    claimReward: () => {
      let didClaim = false;

      const updatedUser = userService.updateCurrentUser((user) => {
        if (user.pendingCoinRewards <= 0) {
          return user;
        }

        didClaim = true;
        return {
          ...user,
          coins: user.coins + COIN_REWARD_AMOUNT,
          pendingCoinRewards: Math.max(0, user.pendingCoinRewards - 1)
        };
      });

      if (!updatedUser || !didClaim) {
        return null;
      }

      notificationService.addNotification({
        type: "reward",
        title: "Recompensa resgatada",
        message: `+${COIN_REWARD_AMOUNT} coins adicionadas ao seu saldo.`,
        actionType: "reward_claimed"
      });

      return userService.getCurrentUser();
    },
    getPendingCoinRewards: () => {
      return userService.getCurrentUser()?.pendingCoinRewards ?? 0;
    },
    onRewardAvailable: (listener) => {
      rewardListeners.add(listener);
      return () => {
        rewardListeners.delete(listener);
      };
    }
  };
}
