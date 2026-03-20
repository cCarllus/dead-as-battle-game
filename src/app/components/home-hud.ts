// Responsável por orquestrar HUD do jogador na Home (moedas, notificações e recompensa pendente).
import type { Locale } from "../i18n";
import type { NotificationService } from "../services/notification.service";
import type { RewardService } from "../services/reward.service";
import type { UserService } from "../services/user.service";
import { mountRewardToast } from "./reward-toast";
import { mountNavbarNotificationCenter } from "./navbar-notification-center";

export type HomeHudOptions = {
  menu: HTMLElement;
  locale: Locale;
  userService: UserService;
  rewardService: RewardService;
  notificationService: NotificationService;
  initialCoins: number;
};

export type HomeHudHandle = {
  isNotificationModalOpen: () => boolean;
  dispose: () => void;
};

export function mountHomeHud(options: HomeHudOptions): HomeHudHandle {
  const notificationCenter = mountNavbarNotificationCenter({
    menu: options.menu,
    locale: options.locale,
    userService: options.userService,
    notificationService: options.notificationService,
    initialCoins: options.initialCoins
  });

  const refreshCoinsAndPendingRewards = (): void => {
    const currentUser = options.userService.getCurrentUser();
    if (!currentUser) {
      notificationCenter.setCoins(0);
      rewardToast.setPendingRewards(0);
      return;
    }

    notificationCenter.setCoins(currentUser.coins);
    rewardToast.setPendingRewards(currentUser.pendingCoinRewards);
  };

  const rewardToast = mountRewardToast({
    menu: options.menu,
    locale: options.locale,
    onClaim: () => {
      const claimedUser = options.rewardService.claimReward();
      if (!claimedUser) {
        return;
      }

      notificationCenter.setCoins(claimedUser.coins);
      rewardToast.setPendingRewards(claimedUser.pendingCoinRewards);
      notificationCenter.refresh();
    }
  });

  const disposeRewardListener = options.rewardService.onRewardAvailable(() => {
    refreshCoinsAndPendingRewards();
    notificationCenter.refresh();
  });

  const syncHud = (): void => {
    refreshCoinsAndPendingRewards();
    notificationCenter.refresh();
  };

  syncHud();

  return {
    isNotificationModalOpen: () => notificationCenter.isNotificationModalOpen(),
    dispose: () => {
      disposeRewardListener();
      notificationCenter.dispose();
      rewardToast.dispose();
    }
  };
}
