import { t, type Locale } from "../../i18n";
import type { ChatMessage } from "../../models/chat-message.model";
import { CHAT_MAX_MESSAGE_LENGTH, type ChatError, type ChatService } from "../../services/chat.service";
import { bind, qs } from "./dom";

const MAX_RENDERED_MESSAGES = 100;

type ChatPanelOptions = {
  locale: Locale;
  container: HTMLElement;
  chatService: ChatService;
  currentUserId: string;
  triggerButton?: HTMLButtonElement | null;
  onMessageSound?: (message: ChatMessage) => void;
};

function formatTime(locale: Locale, timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveErrorMessage(locale: Locale, error: ChatError): string {
  switch (error.code) {
    case "COOLDOWN":
      return t(locale, "chat.error.cooldown");
    case "TOO_LONG":
      return t(locale, "chat.error.tooLong", { max: CHAT_MAX_MESSAGE_LENGTH });
    case "DISCONNECTED":
      return t(locale, "chat.error.disconnected");
    case "NO_IDENTITY":
      return t(locale, "chat.error.noIdentity");
    case "NOT_CONNECTED":
      return t(locale, "chat.error.notConnected");
    default:
      return error.message;
  }
}

function toUserHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 360;
}

function createMessageElement(locale: Locale, message: ChatMessage, currentUserId: string): HTMLLIElement {
  const isSelf = message.userId === currentUserId;
  const item = document.createElement("li");
  item.className = isSelf
    ? "dab-global-chat__message is-self"
    : "dab-global-chat__message is-other";

  if (!isSelf) {
    const hue = toUserHue(message.userId || message.nickname);
    item.style.setProperty("--dab-chat-user-color", `hsl(${hue} 100% 74%)`);
  }

  const header = document.createElement("div");
  header.className = "dab-global-chat__message-head";

  const identity = document.createElement("span");
  identity.className = "dab-global-chat__identity";

  const nickname = document.createElement("strong");
  nickname.className = "dab-global-chat__nickname";
  nickname.textContent = message.nickname;

  const championMeta = document.createElement("small");
  championMeta.className = "dab-global-chat__champion-meta";
  championMeta.textContent = `${message.championName} (${t(locale, "champions.level", { value: message.championLevel })})`;
  identity.append(nickname, championMeta);

  const timestamp = document.createElement("time");
  timestamp.className = "dab-global-chat__time";
  timestamp.dateTime = new Date(message.timestamp).toISOString();
  timestamp.textContent = formatTime(locale, message.timestamp);

  header.append(identity, timestamp);

  const text = document.createElement("p");
  text.className = "dab-global-chat__text";
  text.textContent = message.text;

  item.append(header, text);
  return item;
}

export function mountChatPanel(options: ChatPanelOptions): () => void {
  const panel = document.createElement("section");
  panel.className = "dab-global-chat-panel";
  panel.innerHTML = `
    <header class="dab-global-chat__header">
      <div>
        <h3>${t(options.locale, "chat.title")}</h3>
        <p>${t(options.locale, "chat.subtitle")}</p>
      </div>
    </header>

    <ul class="dab-global-chat__messages" data-slot="messages" role="log" aria-live="polite"></ul>

    <p class="dab-global-chat__error" data-slot="error" hidden></p>

    <form class="dab-global-chat__composer" data-slot="form">
      <input
        class="dab-global-chat__input"
        type="text"
        maxlength="${CHAT_MAX_MESSAGE_LENGTH}"
        placeholder="${t(options.locale, "chat.placeholder")}" 
        autocomplete="off"
      />
      <button type="submit" class="dab-global-chat__send">${t(options.locale, "chat.send")}</button>
    </form>

    <p class="dab-global-chat__counter" data-slot="counter">0/${CHAT_MAX_MESSAGE_LENGTH}</p>
  `;

  options.container.replaceChildren(panel);

  const messagesList = qs<HTMLUListElement>(panel, '[data-slot="messages"]');
  const errorNode = qs<HTMLParagraphElement>(panel, '[data-slot="error"]');
  const counterNode = qs<HTMLParagraphElement>(panel, '[data-slot="counter"]');
  const form = qs<HTMLFormElement>(panel, '[data-slot="form"]');
  const input = qs<HTMLInputElement>(panel, ".dab-global-chat__input");

  const cleanups: Array<() => void> = [];

  let renderedMessages: ChatMessage[] = [];
  let errorTimeoutId: number | null = null;

  const clearError = (): void => {
    if (errorTimeoutId !== null) {
      window.clearTimeout(errorTimeoutId);
      errorTimeoutId = null;
    }

    errorNode.hidden = true;
    errorNode.textContent = "";
  };

  const showError = (text: string): void => {
    clearError();
    errorNode.hidden = false;
    errorNode.textContent = text;

    errorTimeoutId = window.setTimeout(() => {
      clearError();
    }, 2400);
  };

  const updateCounter = (): void => {
    counterNode.textContent = `${input.value.length}/${CHAT_MAX_MESSAGE_LENGTH}`;
  };

  const scrollMessagesToBottom = (): void => {
    messagesList.scrollTop = messagesList.scrollHeight;
  };

  const renderAllMessages = (): void => {
    messagesList.replaceChildren();

    renderedMessages.forEach((message) => {
      messagesList.appendChild(createMessageElement(options.locale, message, options.currentUserId));
    });

    scrollMessagesToBottom();
  };

  const appendMessage = (message: ChatMessage): void => {
    renderedMessages.push(message);
    if (renderedMessages.length > MAX_RENDERED_MESSAGES) {
      renderedMessages.shift();
    }

    messagesList.appendChild(createMessageElement(options.locale, message, options.currentUserId));
    while (messagesList.children.length > MAX_RENDERED_MESSAGES) {
      messagesList.removeChild(messagesList.firstElementChild as Node);
    }

    scrollMessagesToBottom();
    options.onMessageSound?.(message);
  };

  const submitMessage = (): void => {
    const text = input.value.trim();
    if (!text) {
      return;
    }

    options.chatService.sendMessage(text);
    input.value = "";
    updateCounter();
  };

  cleanups.push(
    bind(form, "submit", (event) => {
      event.preventDefault();
      submitMessage();
    })
  );

  cleanups.push(
    bind(input, "input", () => {
      updateCounter();
      clearError();
    })
  );

  if (options.triggerButton) {
    cleanups.push(
      bind(options.triggerButton, "click", () => {
        input.focus();
      })
    );
  }

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const isTypingContext =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable;

    if (!isTypingContext) {
      input.focus();
    }
  };

  window.addEventListener("keydown", onWindowKeyDown);
  cleanups.push(() => {
    window.removeEventListener("keydown", onWindowKeyDown);
  });

  cleanups.push(
    options.chatService.onHistory((history) => {
      renderedMessages = history.slice(-MAX_RENDERED_MESSAGES);
      renderAllMessages();
    })
  );

  cleanups.push(
    options.chatService.onMessage((message) => {
      appendMessage(message);
    })
  );

  cleanups.push(
    options.chatService.onError((error) => {
      showError(resolveErrorMessage(options.locale, error));
    })
  );

  void options.chatService.connect().catch((error: unknown) => {
    if (error instanceof Error) {
      showError(error.message);
      return;
    }

    showError(t(options.locale, "chat.error.notConnected"));
  });

  updateCounter();

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });

    clearError();
    options.container.replaceChildren();
  };
}
