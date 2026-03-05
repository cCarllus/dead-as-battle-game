// Responsável por montar a estrutura visual e conteúdo estático da tela Home.
import { t, type Locale } from "../../i18n";
import { qs } from "../components/dom";
import { mountChampionPreview } from "../components/champion-preview";
import { renderNavbar } from "../components/navbar";
import { TEAM_TOTAL_SLOTS, createTeamSlots, FOOTER_ACTIONS, type TeamSlot } from "./home.model";
import type { MenuTabId } from "../navigation/menu.model";

export type HomeViewOptions = {
  root: HTMLElement;
  locale: Locale;
  activeTab: MenuTabId;
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  selectedChampionModelUrl: string | null;
  selectedChampionSplashImageUrl: string;
  selectedChampionThemeColor: string;
  isUserChampion: boolean;
  isSessionActive: boolean;
};

export type HomeViewResult = {
  menu: HTMLElement;
  dispose: () => void;
};

function countPlayers(slots: readonly TeamSlot[]): number {
  return slots.filter((slot) => slot.type === "player").length;
}

function renderTeamSlots(container: HTMLElement, locale: Locale, slots: readonly TeamSlot[]): void {
  container.replaceChildren();

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dab-roster__slot";

    if (slot.type === "empty") {
      button.classList.add("dab-roster__slot--empty");
      button.setAttribute("aria-label", t(locale, slot.ariaLabelKey));

      const plus = document.createElement("span");
      plus.className = "dab-roster__plus";
      plus.textContent = "+";
      button.appendChild(plus);
      container.appendChild(button);
      return;
    }

    if (slot.isSelf) {
      button.classList.add("dab-roster__slot--self");
    }

    const avatar = document.createElement("span");
    avatar.className = "dab-roster__avatar";

    const avatarIcon = document.createElement("span");
    avatarIcon.className = "dab-roster__avatar-icon";
    avatarIcon.textContent = slot.name.slice(0, 1).toUpperCase();
    avatar.appendChild(avatarIcon);

    const status = document.createElement("span");
    status.className = slot.isOnline
      ? "dab-roster__status"
      : "dab-roster__status dab-roster__status--offline";
    avatar.appendChild(status);

    const text = document.createElement("span");
    text.className = "dab-roster__info";

    const name = document.createElement("strong");
    name.textContent = slot.name;

    const detail = document.createElement("small");
    detail.textContent = t(locale, slot.detailKey, slot.detailParams);
    text.append(name, detail);

    button.append(avatar, text);
    container.appendChild(button);
  });
}

function renderFooterActions(container: HTMLElement, locale: Locale): void {
  container.replaceChildren();

  FOOTER_ACTIONS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dab-footer-button";
    button.dataset.action = item.action;

    if (item.action === "champions") {
      const icon = document.createElement("span");
      icon.className = "dab-footer-button__icon";
      icon.textContent = "✦";
      button.appendChild(icon);
    }

    if (item.action === "settings") {
      const icon = document.createElement("span");
      icon.className = "dab-footer-button__icon";
      icon.textContent = "⚙";
      button.appendChild(icon);
    }

    if (item.action === "exit") {
      const keycap = document.createElement("span");
      keycap.className = "dab-keycap";
      keycap.textContent = "ESC";
      button.appendChild(keycap);
    }

    const label = document.createElement("span");
    label.textContent = t(locale, item.labelKey);
    button.appendChild(label);

    container.appendChild(button);
  });
}

export function renderHomeView(options: HomeViewOptions): HomeViewResult {
  const teamSlotsModel = createTeamSlots({
    playerName: options.playerName,
    selectedChampionName: options.selectedChampionName,
    selectedChampionLevel: options.selectedChampionLevel,
    isOnline: options.isSessionActive
  });

  const menu = qs<HTMLElement>(options.root, ".dab-menu");
  menu.setAttribute("aria-label", t(options.locale, "menu.aria.main"));
  menu.style.setProperty("--dab-champion-theme", options.selectedChampionThemeColor);

  const menuBackground = qs<HTMLElement>(menu, ".dab-menu__bg");
  menuBackground.style.background =
    `linear-gradient(135deg, #0b1021 0%, #1a1b41 48%, #2d1b4e 100%), ` +
    `url("${options.selectedChampionSplashImageUrl}")`;
  menuBackground.style.backgroundBlendMode = "overlay";
  menuBackground.style.backgroundSize = "cover";
  menuBackground.style.backgroundPosition = "center";

  const navbar = qs<HTMLElement>(menu, '[data-slot="navbar"]');
  renderNavbar(navbar, {
    locale: options.locale,
    activeTab: options.activeTab
  });

  const welcomeMessage = qs<HTMLElement>(menu, '[data-slot="welcome-message"]');
  welcomeMessage.textContent = t(options.locale, "home.welcome", {
    nickname: options.playerName
  });

  const championMessage = qs<HTMLElement>(menu, '[data-slot="champion-message"]');
  championMessage.textContent = t(options.locale, "home.currentChampion", {
    champion: options.selectedChampionName,
    level: options.selectedChampionLevel
  });

  const userChampionBadge = qs<HTMLElement>(menu, '[data-slot="user-champion-badge"]');
  userChampionBadge.hidden = !options.isUserChampion;
  userChampionBadge.textContent = t(options.locale, "home.userChampionBadge");

  const rosterCount = qs<HTMLElement>(menu, '[data-slot="roster-count"]');
  rosterCount.textContent = t(options.locale, "menu.roster.count", {
    current: countPlayers(teamSlotsModel),
    total: TEAM_TOTAL_SLOTS
  });

  const teamSlots = qs<HTMLElement>(menu, '[data-slot="team-slots"]');
  renderTeamSlots(teamSlots, options.locale, teamSlotsModel);

  const footerActions = qs<HTMLElement>(menu, '[data-slot="footer-actions"]');
  renderFooterActions(footerActions, options.locale);

  const playSection = qs<HTMLElement>(menu, ".dab-play");
  playSection.setAttribute("aria-label", t(options.locale, "menu.aria.playModes"));

  const championPreview = qs<HTMLElement>(menu, "#champion-preview");
  const disposeChampionPreview = mountChampionPreview(championPreview, {
    modelUrl: options.selectedChampionModelUrl,
    themeColor: options.selectedChampionThemeColor
  });

  const pingSlot = qs<HTMLElement>(menu, '[data-slot="ping"]');
  pingSlot.textContent = t(options.locale, "menu.play.ping", { value: 42 });

  return {
    menu,
    dispose: () => {
      disposeChampionPreview();
    }
  };
}
