// Responsável por renderizar o centro de notificações com histórico persistido do usuário.
import { t, type Locale } from "../../i18n";
import type { NotificationItem } from "../../models/notification.model";
import { bind } from "./dom";

export type NotificationModalOptions = {
  menu: HTMLElement;
  locale: Locale;
  getNotifications: () => NotificationItem[];
  onOpen: () => void;
  onMarkAllRead: () => void;
};

export type NotificationModalHandle = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  refresh: () => void;
  dispose: () => void;
};

function formatNotificationDate(locale: Locale, timestamp: number): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function createNotificationItemNode(params: {
  locale: Locale;
  notification: NotificationItem;
}): HTMLElement {
  const item = document.createElement("article");
  item.className = "dab-notification-item";
  item.classList.toggle("is-unread", !params.notification.isRead);

  const header = document.createElement("header");
  header.className = "dab-notification-item__header";

  const title = document.createElement("strong");
  title.textContent = params.notification.title;

  const time = document.createElement("small");
  time.textContent = formatNotificationDate(params.locale, params.notification.createdAt);

  const message = document.createElement("p");
  message.textContent = params.notification.message;

  header.append(title, time);
  item.append(header, message);

  return item;
}

export function mountNotificationModal(options: NotificationModalOptions): NotificationModalHandle {
  const root = document.createElement("div");
  root.className = "dab-notification-modal";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  root.innerHTML = `
    <button type="button" class="dab-notification-modal__overlay" data-notification-action="close" aria-label="${t(options.locale, "notifications.close")}"></button>
    <section class="dab-notification-modal__panel" role="dialog" aria-modal="true" aria-labelledby="dab-notification-title">
      <header class="dab-notification-modal__header">
        <h2 id="dab-notification-title">${t(options.locale, "notifications.title")}</h2>
      </header>
      <div class="dab-notification-modal__list" data-slot="notifications-list"></div>
      <footer class="dab-notification-modal__footer">
        <button type="button" class="dab-settings-ghost" data-notification-action="mark-read">${t(options.locale, "notifications.markAllRead")}</button>
        <button type="button" class="dab-settings-secondary" data-notification-action="close">${t(options.locale, "notifications.close")}</button>
      </footer>
    </section>
  `;

  options.menu.appendChild(root);

  const list = root.querySelector<HTMLElement>('[data-slot="notifications-list"]');
  if (!list) {
    throw new Error("Lista de notificações não encontrada.");
  }

  let opened = false;

  const renderList = (): void => {
    const notifications = options.getNotifications().slice().sort((left, right) => right.createdAt - left.createdAt);
    list.replaceChildren();

    if (notifications.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "dab-notification-modal__empty";
      emptyState.textContent = t(options.locale, "notifications.empty");
      list.appendChild(emptyState);
      return;
    }

    notifications.forEach((notification) => {
      list.appendChild(
        createNotificationItemNode({
          locale: options.locale,
          notification
        })
      );
    });
  };

  const open = (): void => {
    options.onOpen();
    renderList();
    opened = true;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.add("is-open");
  };

  const close = (): void => {
    opened = false;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;
  };

  const disposeClick = bind(root, "click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const actionButton = target.closest<HTMLButtonElement>("[data-notification-action]");
    if (!actionButton || !root.contains(actionButton)) {
      return;
    }

    const action = actionButton.dataset.notificationAction;
    if (action === "mark-read") {
      options.onMarkAllRead();
      renderList();
      return;
    }

    if (action === "close") {
      close();
    }
  });

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && opened) {
      event.preventDefault();
      close();
    }
  };

  window.addEventListener("keydown", onWindowKeyDown);

  return {
    open,
    close,
    isOpen: () => opened,
    refresh: () => {
      if (!opened) {
        return;
      }

      renderList();
    },
    dispose: () => {
      disposeClick();
      window.removeEventListener("keydown", onWindowKeyDown);
      root.remove();
    }
  };
}
