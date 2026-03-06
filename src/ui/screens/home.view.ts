// Responsável por montar a estrutura visual e conteúdo estático da tela Home.
import { t, type Locale } from "../../i18n";
import { qs } from "../components/dom";
import { mountChampionPreview } from "../components/champion-preview";
import { renderNavbar } from "../components/navbar";
import { TEAM_TOTAL_SLOTS, FOOTER_ACTIONS } from "./home.model";
import type { MenuTabId } from "../navigation/menu.model";

export type HomeSelectedChampionStats = {
  championName: string;
  kills: number;
  deaths: number;
};

export type HomeViewOptions = {
  root: HTMLElement;
  locale: Locale;
  activeTab: MenuTabId;
  coins: number;
  playerName: string;
  selectedChampionName: string;
  selectedChampionLevel: number;
  selectedChampionModelUrl: string | null;
  selectedChampionSplashImageUrl: string;
  selectedChampionThemeColor: string;
  isUserChampion: boolean;
  isSessionActive: boolean;
  selectedChampionStats: HomeSelectedChampionStats;
};

export type HomeViewResult = {
  menu: HTMLElement;
  dispose: () => void;
};

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
    activeTab: options.activeTab,
    coins: options.coins
  });

  const welcomeMessage = qs<HTMLElement>(menu, '[data-slot="welcome-message"]');
  welcomeMessage.textContent = t(options.locale, "home.welcome", {
    nickname: options.playerName
  });

  const onlineUsersLabel = qs<HTMLElement>(menu, '[data-slot="online-users-label"]');
  onlineUsersLabel.textContent = t(options.locale, "home.onlineUsers");

  const championKdCard = qs<HTMLElement>(menu, '[data-slot="champion-kd-card"]');
  championKdCard.replaceChildren();

  const kdHeader = document.createElement("div");
  kdHeader.className = "dab-kd-card__header";

  const kdTitle = document.createElement("strong");
  kdTitle.textContent = t(options.locale, "home.stats.title");

  const kdChampionName = document.createElement("small");
  kdChampionName.textContent = options.selectedChampionStats.championName;

  kdHeader.append(kdTitle, kdChampionName);

  const kdBody = document.createElement("div");
  kdBody.className = "dab-kd-card__body";

  const killsItem = document.createElement("article");
  killsItem.className = "dab-kd-card__item is-kills";

  const killsIcon = document.createElement("span");
  killsIcon.className = "dab-kd-card__icon";
  killsIcon.setAttribute("aria-hidden", "true");
  killsIcon.textContent = "✦";

  const killsLabel = document.createElement("small");
  killsLabel.textContent = t(options.locale, "home.stats.kills");

  const killsValue = document.createElement("strong");
  killsValue.textContent = String(options.selectedChampionStats.kills);

  killsItem.append(killsIcon, killsLabel, killsValue);

  const deathsItem = document.createElement("article");
  deathsItem.className = "dab-kd-card__item is-deaths";

  const deathsIcon = document.createElement("span");
  deathsIcon.className = "dab-kd-card__icon";
  deathsIcon.setAttribute("aria-hidden", "true");
  deathsIcon.textContent = "☠";

  const deathsLabel = document.createElement("small");
  deathsLabel.textContent = t(options.locale, "home.stats.deaths");

  const deathsValue = document.createElement("strong");
  deathsValue.textContent = String(options.selectedChampionStats.deaths);

  deathsItem.append(deathsIcon, deathsLabel, deathsValue);

  kdBody.append(killsItem, deathsItem);
  championKdCard.append(kdHeader, kdBody);

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
    current: 0,
    total: TEAM_TOTAL_SLOTS
  });

  const teamSlots = qs<HTMLElement>(menu, '[data-slot="team-slots"]');
  teamSlots.replaceChildren();

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
