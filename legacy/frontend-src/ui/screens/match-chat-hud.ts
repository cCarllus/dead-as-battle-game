// Responsible for the chat feed panel, chat composer input, and floating speech bubbles above players.
import { MATCH_UI_CONFIG } from "../../game/config/ui.config";
import { CHAT_MAX_MESSAGE_LENGTH } from "../../services/chat.service";
import type { Locale } from "../../i18n";
import { bind } from "../components/dom";

const MATCH_HUD_FEED_MAX_ITEMS = MATCH_UI_CONFIG.hudFeed.maxItems;
const MATCH_HUD_FEED_TTL_MS = MATCH_UI_CONFIG.hudFeed.ttlMs;
const MATCH_HUD_FEED_FADE_WINDOW_MS = MATCH_UI_CONFIG.hudFeed.fadeWindowMs;
const MATCH_CHAT_BUBBLE_TTL_MS = MATCH_UI_CONFIG.chatBubble.ttlMs;
const MATCH_CHAT_BUBBLE_FADE_WINDOW_MS = MATCH_UI_CONFIG.chatBubble.fadeWindowMs;
const MATCH_CHAT_BUBBLE_MAX_CHARS = MATCH_UI_CONFIG.chatBubble.maxChars;

export type MatchHudFeedEntry = {
  id: string;
  kind: "server" | "chat";
  nickname: string | null;
  text: string;
  createdAt: number;
  expiresAt: number;
};

export type MatchSpeechBubbleEntry = {
  sessionId: string;
  text: string;
  createdAt: number;
  expiresAt: number;
  element: HTMLDivElement;
  textNode: HTMLSpanElement;
};

export type MatchChatHudOptions = {
  locale: Locale;
  screen: HTMLElement;
  hudChatFeed: HTMLElement;
  hudSpeechLayer: HTMLElement;
  chatComposer: HTMLFormElement;
  chatInput: HTMLInputElement;
  getPlayerScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  isComposerAllowed: () => boolean;
  onComposerOpen: () => void;
  onComposerClose: (resumePointerLock: boolean) => void;
  onSendMessage: (text: string) => void;
  setChatFocused: (focused: boolean) => void;
  applyInputState: () => void;
};

export type MatchChatHudHandle = {
  addMessage(entry: Omit<MatchHudFeedEntry, "createdAt" | "expiresAt">): void;
  addSpeechBubble(params: { sessionId: string; text: string }): void;
  removeSpeechBubble(sessionId: string): void;
  openComposer(): void;
  closeComposer(resumePointerLock: boolean): void;
  isComposerOpen(): boolean;
  tick(now: number): void;
  dispose(): void;
};

export function createMatchChatHud(options: MatchChatHudOptions): MatchChatHudHandle {
  let hudFeedEntries: MatchHudFeedEntry[] = [];
  let chatComposerOpen = false;
  let shouldResumePointerLockAfterChat = false;
  let speechBubbleFrameId: number | null = null;
  const speechBubblesBySessionId = new Map<string, MatchSpeechBubbleEntry>();

  options.chatInput.maxLength = CHAT_MAX_MESSAGE_LENGTH;
  options.chatInput.placeholder = options.locale === "pt-BR" ? "Digite e pressione Enter" : "Type and press Enter";

  const truncateChatBubbleText = (text: string): string => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= MATCH_CHAT_BUBBLE_MAX_CHARS) {
      return normalized;
    }

    return `${normalized.slice(0, MATCH_CHAT_BUBBLE_MAX_CHARS - 1).trimEnd()}\u2026`;
  };

  const removeSpeechBubble = (sessionId: string): void => {
    const bubble = speechBubblesBySessionId.get(sessionId);
    if (!bubble) {
      return;
    }

    bubble.element.remove();
    speechBubblesBySessionId.delete(sessionId);
  };

  const renderSpeechBubbles = (): void => {
    const now = Date.now();

    speechBubblesBySessionId.forEach((bubble, sessionId) => {
      if (bubble.expiresAt <= now) {
        removeSpeechBubble(sessionId);
        return;
      }

      const playerScreenPosition = options.getPlayerScreenPosition(sessionId);
      if (!playerScreenPosition) {
        bubble.element.hidden = true;
        return;
      }

      const fadeProgress =
        bubble.expiresAt - now > MATCH_CHAT_BUBBLE_FADE_WINDOW_MS
          ? 1
          : Math.max(0, (bubble.expiresAt - now) / MATCH_CHAT_BUBBLE_FADE_WINDOW_MS);

      bubble.element.hidden = false;
      bubble.element.style.setProperty("--dab-speech-x", `${playerScreenPosition.x}px`);
      bubble.element.style.setProperty("--dab-speech-y", `${playerScreenPosition.y - 74}px`);
      bubble.element.style.setProperty("--dab-speech-opacity", fadeProgress.toFixed(3));
    });

    speechBubbleFrameId = window.requestAnimationFrame(renderSpeechBubbles);
  };

  const upsertSpeechBubble = (sessionId: string, text: string): void => {
    const now = Date.now();
    const normalizedText = truncateChatBubbleText(text);
    let bubble = speechBubblesBySessionId.get(sessionId);
    if (!bubble) {
      const element = document.createElement("div");
      element.className = "dab-match__speech-bubble";

      const textNode = document.createElement("span");
      textNode.className = "dab-match__speech-text";

      const tail = document.createElement("span");
      tail.className = "dab-match__speech-tail";

      element.append(textNode, tail);
      options.hudSpeechLayer.appendChild(element);

      bubble = {
        sessionId,
        text: normalizedText,
        createdAt: now,
        expiresAt: now + MATCH_CHAT_BUBBLE_TTL_MS,
        element,
        textNode
      };
      speechBubblesBySessionId.set(sessionId, bubble);
    }

    bubble.text = normalizedText;
    bubble.createdAt = now;
    bubble.expiresAt = now + MATCH_CHAT_BUBBLE_TTL_MS;
    bubble.textNode.textContent = normalizedText;
  };

  const pruneHudFeedEntries = (now = Date.now()): void => {
    hudFeedEntries = hudFeedEntries.filter((entry) => entry.expiresAt > now);
    if (hudFeedEntries.length > MATCH_HUD_FEED_MAX_ITEMS) {
      hudFeedEntries = hudFeedEntries.slice(-MATCH_HUD_FEED_MAX_ITEMS);
    }
  };

  const renderHudFeed = (): void => {
    const now = Date.now();
    pruneHudFeedEntries(now);
    options.hudChatFeed.replaceChildren();

    hudFeedEntries.forEach((entry) => {
      const ageMs = Math.max(0, now - entry.createdAt);
      const timeRemainingMs = Math.max(0, entry.expiresAt - now);
      const fadeProgress =
        timeRemainingMs >= MATCH_HUD_FEED_FADE_WINDOW_MS
          ? 1
          : Math.max(0, timeRemainingMs / MATCH_HUD_FEED_FADE_WINDOW_MS);
      const stackProgress = 1 - Math.min(0.34, (hudFeedEntries.length - 1 - hudFeedEntries.indexOf(entry)) * 0.06);
      const opacity = Math.max(0, Math.min(1, fadeProgress * stackProgress));
      const offsetY = Math.min(10, ageMs / 1400);

      const line = document.createElement("div");
      line.className = `dab-match__chat-line ${entry.kind === "server" ? "is-server" : "is-chat"}`;
      line.style.setProperty("--dab-chat-feed-opacity", opacity.toFixed(3));
      line.style.setProperty("--dab-chat-feed-offset", `${offsetY}px`);

      if (entry.kind === "server") {
        line.textContent = entry.text;
      } else {
        const nickname = document.createElement("span");
        nickname.className = "dab-match__chat-nickname";
        nickname.textContent = `[${entry.nickname ?? "Player"}]:`;

        const message = document.createElement("span");
        message.className = "dab-match__chat-message";
        message.textContent = entry.text;

        line.append(nickname, " ", message);
      }

      options.hudChatFeed.appendChild(line);
    });
  };

  const pushHudFeedEntry = (entry: Omit<MatchHudFeedEntry, "createdAt" | "expiresAt">): void => {
    const now = Date.now();
    hudFeedEntries = [
      ...hudFeedEntries,
      {
        ...entry,
        createdAt: now,
        expiresAt: now + MATCH_HUD_FEED_TTL_MS
      }
    ];
    pruneHudFeedEntries(now);
    renderHudFeed();
  };

  const closeComposerInternal = (resumePointerLock: boolean): void => {
    if (!chatComposerOpen) {
      return;
    }

    chatComposerOpen = false;
    options.screen.classList.remove("is-chat-open");
    options.setChatFocused(false);
    options.chatInput.blur();

    options.onComposerClose(resumePointerLock && shouldResumePointerLockAfterChat);

    shouldResumePointerLockAfterChat = false;
    options.applyInputState();
  };

  const openComposerInternal = (): void => {
    if (chatComposerOpen || !options.isComposerAllowed()) {
      return;
    }

    options.onComposerOpen();
    shouldResumePointerLockAfterChat = true;
    chatComposerOpen = true;
    options.screen.classList.add("is-chat-open");
    options.setChatFocused(true);
    options.applyInputState();

    window.setTimeout(() => {
      options.chatInput.focus();
      options.chatInput.select();
    }, 0);
  };

  // Event bindings
  const disposeChatComposerSubmit = bind(options.chatComposer, "submit", (event) => {
    event.preventDefault();
    const text = options.chatInput.value.trim();
    if (!text) {
      closeComposerInternal(true);
      return;
    }

    options.onSendMessage(text);
    options.chatInput.value = "";
    closeComposerInternal(true);
  });
  const disposeChatInputFocus = bind(options.chatInput, "focus", () => {
    options.setChatFocused(true);
    options.applyInputState();
  });
  const disposeChatInputBlur = bind(options.chatInput, "blur", (event) => {
    const nextTarget = (event as FocusEvent).relatedTarget;
    if (nextTarget instanceof Node && options.chatComposer.contains(nextTarget)) {
      options.setChatFocused(true);
      return;
    }

    if (chatComposerOpen) {
      closeComposerInternal(false);
      return;
    }

    options.setChatFocused(false);
    options.applyInputState();
  });
  const disposeChatInputKeyDown = bind(options.chatInput, "keydown", (event) => {
    event.stopPropagation();

    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeComposerInternal(true);
  });
  const disposeChatInputKeyUp = bind(options.chatInput, "keyup", (event) => {
    event.stopPropagation();
  });

  // Start speech bubble animation loop
  renderSpeechBubbles();
  // Initial render of the feed
  renderHudFeed();

  return {
    addMessage(entry) {
      pushHudFeedEntry(entry);
    },
    addSpeechBubble(params) {
      upsertSpeechBubble(params.sessionId, params.text);
    },
    removeSpeechBubble(sessionId: string) {
      removeSpeechBubble(sessionId);
    },
    openComposer() {
      openComposerInternal();
    },
    closeComposer(resumePointerLock: boolean) {
      closeComposerInternal(resumePointerLock);
    },
    isComposerOpen() {
      return chatComposerOpen;
    },
    tick(_now: number) {
      renderHudFeed();
    },
    dispose() {
      disposeChatComposerSubmit();
      disposeChatInputFocus();
      disposeChatInputBlur();
      disposeChatInputKeyDown();
      disposeChatInputKeyUp();

      if (speechBubbleFrameId !== null) {
        window.cancelAnimationFrame(speechBubbleFrameId);
        speechBubbleFrameId = null;
      }

      speechBubblesBySessionId.forEach((bubble) => {
        bubble.element.remove();
      });
      speechBubblesBySessionId.clear();

      hudFeedEntries = [];
      options.hudChatFeed.replaceChildren();
    }
  };
}
