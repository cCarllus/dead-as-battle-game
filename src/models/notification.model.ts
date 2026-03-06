// Responsável por modelar e sanitizar notificações persistidas no perfil do usuário.
export const NOTIFICATION_TYPES = ["reward", "team_invite", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  isRead: boolean;
  actionType?: string;
  actionPayload?: unknown;
};

export type NotificationInput = Omit<NotificationItem, "id" | "createdAt" | "isRead"> & {
  isRead?: boolean;
  createdAt?: number;
};

function createNotificationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `notification_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isNotificationType(rawType: unknown): rawType is NotificationType {
  return typeof rawType === "string" && NOTIFICATION_TYPES.some((notificationType) => notificationType === rawType);
}

function toNonEmptyString(rawText: unknown, fallback: string): string {
  if (typeof rawText !== "string") {
    return fallback;
  }

  const normalized = rawText.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function toSafeTimestamp(rawTimestamp: unknown, fallback: number = Date.now()): number {
  const normalizedTimestamp = Number(rawTimestamp);
  if (!Number.isFinite(normalizedTimestamp)) {
    return fallback;
  }

  return Math.max(0, Math.floor(normalizedTimestamp));
}

export function createNotification(input: NotificationInput): NotificationItem {
  return {
    id: createNotificationId(),
    type: input.type,
    title: input.title.trim(),
    message: input.message.trim(),
    createdAt: toSafeTimestamp(input.createdAt, Date.now()),
    isRead: input.isRead === true,
    actionType: input.actionType?.trim() || undefined,
    actionPayload: input.actionPayload
  };
}

export function sanitizeNotificationItem(rawNotification: unknown): NotificationItem | null {
  if (!rawNotification || typeof rawNotification !== "object") {
    return null;
  }

  const notification = rawNotification as Partial<NotificationItem>;
  if (!isNotificationType(notification.type)) {
    return null;
  }

  return {
    id: toNonEmptyString(notification.id, createNotificationId()),
    type: notification.type,
    title: toNonEmptyString(notification.title, "Notificação"),
    message: toNonEmptyString(notification.message, ""),
    createdAt: toSafeTimestamp(notification.createdAt),
    isRead: notification.isRead === true,
    actionType: typeof notification.actionType === "string" ? notification.actionType.trim() || undefined : undefined,
    actionPayload: notification.actionPayload
  };
}

export function sanitizeNotifications(rawNotifications: unknown, maxItems: number = 200): NotificationItem[] {
  if (!Array.isArray(rawNotifications)) {
    return [];
  }

  return rawNotifications
    .map((rawNotificationItem) => sanitizeNotificationItem(rawNotificationItem))
    .filter((notificationItem): notificationItem is NotificationItem => notificationItem !== null)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, maxItems);
}
