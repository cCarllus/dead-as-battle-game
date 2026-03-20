// Responsável por manter o centro de notificações (moedas + sino + modal) na navbar de qualquer tela.
import type { Locale } from "../i18n";
import type { NotificationService } from "../services/notification.service";
import type { UserService } from "../services/user.service";
import { mountCoinsDisplay } from "./coins-display";
import { qs } from "./dom";
import { mountNotificationBell } from "./notification-bell";
import { mountNotificationModal } from "./notification-modal";

export type NavbarNotificationCenterOptions = {
  menu: HTMLElement;
  locale: Locale;
  userService: UserService;
  notificationService: NotificationService;
  initialCoins: number;
};

export type NavbarNotificationCenterHandle = {
  refresh: () => void;
  setCoins: (coins: number) => void;
  isNotificationModalOpen: () => boolean;
  dispose: () => void;
};

export function mountNavbarNotificationCenter(
  options: NavbarNotificationCenterOptions
): NavbarNotificationCenterHandle {
  const toolsContainer = qs<HTMLElement>(options.menu, '[data-slot="menu-tools"]');
  toolsContainer.replaceChildren();

  const coinsDisplay = mountCoinsDisplay({
    container: toolsContainer,
    locale: options.locale,
    initialCoins: options.initialCoins
  });

  const syncCoinsFromUser = (): void => {
    const currentUser = options.userService.getCurrentUser();
    coinsDisplay.setCoins(currentUser?.coins ?? 0);
  };

  const syncNotificationState = (): void => {
    notificationBell.setUnreadCount(options.notificationService.getUnreadCount());
    notificationModal.refresh();
  };

  const markNotificationsAsRead = (): void => {
    options.notificationService.markNotificationsAsRead();
    syncNotificationState();
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
    container: toolsContainer,
    locale: options.locale,
    unreadCount: options.notificationService.getUnreadCount(),
    onClick: () => {
      notificationModal.open();
    }
  });

  const disposeNotificationChanged = options.notificationService.onNotificationsChanged(() => {
    syncNotificationState();
  });

  const refresh = (): void => {
    syncCoinsFromUser();
    syncNotificationState();
  };

  refresh();

  return {
    refresh,
    setCoins: (coins) => {
      coinsDisplay.setCoins(coins);
    },
    isNotificationModalOpen: () => notificationModal.isOpen(),
    dispose: () => {
      disposeNotificationChanged();
      notificationModal.dispose();
      notificationBell.dispose();
      coinsDisplay.dispose();
    }
  };
}
