import { t, type Locale } from "../../i18n";
import type { ChatMessage } from "../../models/chat-message.model";
import { createMenuIcon } from "./menu-icon";

export type ChatMessageItemOptions = {
  locale: Locale;
  message: ChatMessage;
  currentUserId: string;
  onInvitePlayer?: (userId: string, nickname: string) => void;
  isPlayerInTeam?: (userId: string) => boolean;
};

function formatTime(locale: Locale, timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toUserHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 360;
}

export function createChatMessageItem(options: ChatMessageItemOptions): HTMLLIElement {
  const { locale, message, currentUserId, onInvitePlayer, isPlayerInTeam } = options;
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

  const nicknameWrap = document.createElement("span");
  nicknameWrap.className = "dab-global-chat__nickname-wrap";

  const nickname = document.createElement("strong");
  nickname.className = "dab-global-chat__nickname";
  nickname.textContent = message.nickname;
  nicknameWrap.appendChild(nickname);

  if (!isSelf) {
    const alreadyInTeam = isPlayerInTeam?.(message.userId) ?? false;
    const inviteButton = document.createElement("button");
    inviteButton.type = "button";
    inviteButton.className = "dab-global-chat__invite";
    inviteButton.setAttribute("aria-label", t(locale, "team.chat.inviteAria", { nickname: message.nickname }));

    if (alreadyInTeam) {
      inviteButton.classList.add("is-checked");
      inviteButton.disabled = true;
      inviteButton.title = t(locale, "team.chat.alreadyInTeam");
      inviteButton.appendChild(createMenuIcon("check", { className: "dab-global-chat__invite-icon" }));
    } else {
      inviteButton.title = t(locale, "team.chat.inviteTooltip", { nickname: message.nickname });
      inviteButton.appendChild(createMenuIcon("teamInvite", { className: "dab-global-chat__invite-icon" }));

      inviteButton.addEventListener("click", () => {
        onInvitePlayer?.(message.userId, message.nickname);
      });
    }

    nicknameWrap.appendChild(inviteButton);
  }

  const championMeta = document.createElement("small");
  championMeta.className = "dab-global-chat__champion-meta";
  championMeta.textContent = `${message.championName} (${t(locale, "champions.level", { value: message.championLevel })})`;
  identity.append(nicknameWrap, championMeta);

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
