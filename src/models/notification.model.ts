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

function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && NOTIFICATION_TYPES.some((type) => type === value);
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function toSafeTimestamp(value: unknown, fallback: number = Date.now()): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(Number(value)));
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

export function sanitizeNotificationItem(value: unknown): NotificationItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const notification = value as Partial<NotificationItem>;
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

export function sanitizeNotifications(value: unknown, maxItems: number = 200): NotificationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeNotificationItem(item))
    .filter((item): item is NotificationItem => item !== null)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, maxItems);
}
