// Responsável por orquestrar HUD do jogador na Home (moedas, notificações e recompensa pendente).
import type { Locale } from "../../i18n";
import type { NotificationService } from "../../services/notification.service";
import type { RewardService } from "../../services/reward.service";
import type { UserService } from "../../services/user.service";
import { qs } from "./dom";
import { mountCoinsDisplay } from "./coins-display";
import { mountNotificationBell } from "./notification-bell";
import { mountNotificationModal } from "./notification-modal";
import { mountRewardToast } from "./reward-toast";

export type HomeHudOptions = {
  menu: HTMLElement;
  locale: Locale;
  userService: UserService;
  rewardService: RewardService;
  notificationService: NotificationService;
  initialCoins: number;
};

export type HomeHudHandle = {
  refresh: () => void;
  isNotificationModalOpen: () => boolean;
  dispose: () => void;
};

export function mountHomeHud(options: HomeHudOptions): HomeHudHandle {
  const menuToolsContainer = qs<HTMLElement>(options.menu, '[data-slot="menu-tools"]');
  menuToolsContainer.replaceChildren();

  const coinsDisplay = mountCoinsDisplay({
    container: menuToolsContainer,
    locale: options.locale,
    initialCoins: options.initialCoins
  });

  const refreshCoinsAndRewards = (): void => {
    const currentUser = options.userService.getCurrentUser();
    if (!currentUser) {
      coinsDisplay.setCoins(0);
      rewardToast.setPendingRewards(0);
      return;
    }

    coinsDisplay.setCoins(currentUser.coins);
    rewardToast.setPendingRewards(currentUser.pendingCoinRewards);
  };

  const refreshUnreadNotifications = (): void => {
    notificationBell.setUnreadCount(options.notificationService.getUnreadCount());
    notificationModal.refresh();
  };

  const markNotificationsAsRead = (): void => {
    options.notificationService.markNotificationsAsRead();
    refreshUnreadNotifications();
  };

  const notificationModal = mountNotificationModal({
    menu: options.menu,
    locale: options.locale,
    getNotifications: () => options.notificationService.getNotifications(),
    onOpen: () => {
      markNotificationsAsRead();
    },
    onMarkAllRead: () => {
      markNotificationsAsRead();
    }
  });

  const notificationBell = mountNotificationBell({
    container: menuToolsContainer,
    locale: options.locale,
    unreadCount: options.notificationService.getUnreadCount(),
    onClick: () => {
      notificationModal.open();
    }
  });

  const rewardToast = mountRewardToast({
    menu: options.menu,
    locale: options.locale,
    onClaim: () => {
      const claimedUser = options.rewardService.claimReward();
      if (!claimedUser) {
        return;
      }

      coinsDisplay.setCoins(claimedUser.coins);
      rewardToast.setPendingRewards(claimedUser.pendingCoinRewards);
      refreshUnreadNotifications();
    }
  });

  const disposeRewardListener = options.rewardService.onRewardAvailable(() => {
    refreshCoinsAndRewards();
    refreshUnreadNotifications();
  });

  const refresh = (): void => {
    refreshCoinsAndRewards();
    refreshUnreadNotifications();
  };

  refresh();

  return {
    refresh,
    isNotificationModalOpen: () => notificationModal.isOpen(),
    dispose: () => {
      disposeRewardListener();
      notificationModal.dispose();
      notificationBell.dispose();
      coinsDisplay.dispose();
      rewardToast.dispose();
    }
  };
}
