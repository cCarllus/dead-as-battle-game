// Responsável por renderizar o sino de notificações com badge de não lidas.
import type { Locale } from "../i18n";
import { bind } from "./dom";
import { createMenuIcon } from "./menu-icon";

export type NotificationBellOptions = {
  container: HTMLElement;
  locale: Locale;
  unreadCount: number;
  onClick: () => void;
};

export type NotificationBellHandle = {
  setUnreadCount: (count: number) => void;
  dispose: () => void;
};

function getBellAriaLabel(locale: Locale, unreadCount: number): string {
  if (locale === "en-US") {
    return unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications";
  }

  return unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações";
}

export function mountNotificationBell(options: NotificationBellOptions): NotificationBellHandle {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dab-icon-button dab-notification-bell";
  button.dataset.action = "open-notifications";

  const icon = createMenuIcon("bell", { className: "dab-notification-bell__icon" });

  const badge = document.createElement("span");
  badge.className = "dab-notification-bell__badge";
  badge.setAttribute("aria-hidden", "true");

  button.append(icon, badge);
  options.container.appendChild(button);

  const setUnreadCount = (count: number): void => {
    const normalizedCount = Math.max(0, Math.floor(count));
    badge.hidden = normalizedCount === 0;
    badge.classList.toggle("is-blinking", normalizedCount > 0);
    button.setAttribute("aria-label", getBellAriaLabel(options.locale, normalizedCount));
  };

  setUnreadCount(options.unreadCount);
  const disposeClick = bind(button, "click", () => {
    options.onClick();
  });

  return {
    setUnreadCount,
    dispose: () => {
      disposeClick();
      button.remove();
    }
  };
}
