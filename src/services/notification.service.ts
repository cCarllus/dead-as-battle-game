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
  candidate: NotificationInput
): boolean {
  if (candidate.type !== "team_invite") {
    return false;
  }

  const inviteId = (candidate.actionPayload as { inviteId?: string } | undefined)?.inviteId;
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
  const getNotifications = (): NotificationItem[] => {
    const user = userService.getCurrentUser();
    if (!user) {
      return [];
    }

    return user.notifications.map((notification) => cloneNotification(notification));
  };

  return {
    getNotifications,
    getUnreadCount: () => {
      return getNotifications().reduce((count, notification) => {
        return notification.isRead ? count : count + 1;
      }, 0);
    },
    addNotification: (notification) => {
      const title = notification.title.trim();
      const message = notification.message.trim();

      if (!title || !message) {
        return null;
      }

      const created = createNotification(notification);
      const nextUser = userService.updateCurrentUser((user) => {
        if (isDuplicateTeamInviteNotification(user.notifications, notification)) {
          return user;
        }

        return {
          ...user,
          notifications: [created, ...user.notifications]
        };
      });

      if (!nextUser) {
        return null;
      }

      const matched = nextUser.notifications.find((entry) => entry.id === created.id);
      return matched ? cloneNotification(matched) : null;
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
