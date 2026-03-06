// Responsável por gerenciar notificações persistidas no perfil do usuário.
import { createNotification, type NotificationInput, type NotificationItem } from "../models/notification.model";
import type { UserService } from "./user.service";

function cloneNotification(notification: NotificationItem): NotificationItem {
  return {
    ...notification,
    actionPayload: notification.actionPayload
  };
}

function isDuplicateTeamInviteNotification(
  notifications: readonly NotificationItem[],
  incomingNotification: NotificationInput
): boolean {
  if (incomingNotification.type !== "team_invite") {
    return false;
  }

  const inviteId = (incomingNotification.actionPayload as { inviteId?: string } | undefined)?.inviteId;
  if (typeof inviteId !== "string" || inviteId.trim().length === 0) {
    return false;
  }

  return notifications.some((notification) => {
    if (notification.type !== "team_invite") {
      return false;
    }

    const existingInviteId = (notification.actionPayload as { inviteId?: string } | undefined)?.inviteId;
    return existingInviteId === inviteId;
  });
}

export type NotificationService = {
  getNotifications: () => NotificationItem[];
  getUnreadCount: () => number;
  addNotification: (notification: NotificationInput) => NotificationItem | null;
  markNotificationsAsRead: () => number;
};

export type NotificationServiceDependencies = {
  userService: UserService;
};

export function createNotificationService({
  userService
}: NotificationServiceDependencies): NotificationService {
  const getNotificationsSnapshot = (): NotificationItem[] => {
    const user = userService.getCurrentUser();
    if (!user) {
      return [];
    }

    return user.notifications.map((notification) => cloneNotification(notification));
  };

  return {
    getNotifications: getNotificationsSnapshot,
    getUnreadCount: () => {
      return getNotificationsSnapshot().reduce((count, notification) => {
        return notification.isRead ? count : count + 1;
      }, 0);
    },
    addNotification: (incomingNotification) => {
      const title = incomingNotification.title.trim();
      const message = incomingNotification.message.trim();

      if (!title || !message) {
        return null;
      }

      const createdNotification = createNotification(incomingNotification);
      const nextUser = userService.updateCurrentUser((user) => {
        if (isDuplicateTeamInviteNotification(user.notifications, incomingNotification)) {
          return user;
        }

        return {
          ...user,
          notifications: [createdNotification, ...user.notifications]
        };
      });

      if (!nextUser) {
        return null;
      }

      const persistedNotification = nextUser.notifications.find((entry) => entry.id === createdNotification.id);
      return persistedNotification ? cloneNotification(persistedNotification) : null;
    },
    markNotificationsAsRead: () => {
      let unreadCount = 0;

      const nextUser = userService.updateCurrentUser((user) => {
        unreadCount = user.notifications.reduce((count, notification) => {
          return notification.isRead ? count : count + 1;
        }, 0);

        if (unreadCount === 0) {
          return user;
        }

        return {
          ...user,
          notifications: user.notifications.map((notification) => ({
            ...notification,
            isRead: true
          }))
        };
      });

      return nextUser ? unreadCount : 0;
    }
  };
}
