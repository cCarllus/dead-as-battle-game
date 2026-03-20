// Responsável por renderizar a tela de campeões com desbloqueio por moedas e seleção segura.
import { t, type Locale } from "../../i18n";
import type { ChampionId } from "../../models/champion.model";
import type { NotificationService } from "../../services/notification.service";
import type { UserService } from "../../services/user.service";
import type { HeroUnlockResult } from "../../services/hero-purchase.service";
import template from "../layout/champions.html?raw";
import { bind, bindDelegatedClick, qs } from "../components/dom";
import { createHeroCardElement, type HeroCardData } from "../components/hero-card";
import { setMenuIconContent } from "../components/menu-icon";
import { renderNavbar } from "../components/navbar";
import { mountNavbarNotificationCenter } from "../components/navbar-notification-center";
import { MENU_NAV_ITEMS, type MenuTabId } from "../navigation/menu.model";
import { renderScreenTemplate, resolveScreenLocale } from "./screen-template";

const MENU_TAB_ID_SET = new Set<string>(MENU_NAV_ITEMS.map((item) => item.id));

function isMenuTabId(value: string | undefined): value is MenuTabId {
  return value !== undefined && MENU_TAB_ID_SET.has(value);
}

function updateActiveTab(screen: HTMLElement, activeTab: MenuTabId): void {
  screen.querySelectorAll<HTMLButtonElement>(".dab-menu__nav-btn[data-tab]").forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
      return;
    }

    button.removeAttribute("aria-current");
  });
}

export type ChampionSelectionCard = HeroCardData;

function findFirstUnlockedChampionId(cards: readonly ChampionSelectionCard[]): ChampionId | null {
  return cards.find((card) => card.isUnlocked)?.id ?? null;
}

function findCardById(
  cards: readonly ChampionSelectionCard[],
  championId: ChampionId
): ChampionSelectionCard | null {
  return cards.find((card) => card.id === championId) ?? null;
}

function resolveUnlockFeedbackMessage(params: {
  locale: Locale;
  result: HeroUnlockResult;
  heroName: string;
}): string {
  switch (params.result.status) {
    case "unlocked":
      return t(params.locale, "champions.feedback.unlocked", { champion: params.heroName });
    case "insufficient_coins":
      return t(params.locale, "champions.feedback.insufficientCoins");
    case "already_unlocked":
      return t(params.locale, "champions.feedback.alreadyUnlocked");
    case "default_hero":
      return t(params.locale, "champions.feedback.defaultHero");
    default:
      return t(params.locale, "champions.feedback.unlockFailed");
  }
}

export type ChampionsActions = {
  locale?: Locale;
  activeTab?: MenuTabId;
  coins?: number;
  userService: UserService;
  notificationService: NotificationService;
  cards: readonly ChampionSelectionCard[];
  selectedChampionId: ChampionId;
  onNavigateTab?: (tab: MenuTabId) => void;
  onPreviewSelection?: (championId: ChampionId) => void;
  onConfirmSelection: (championId: ChampionId) => boolean;
  onUnlockChampion: (championId: ChampionId) => HeroUnlockResult;
  onBack: () => void;
};

export function renderChampionsScreen(root: HTMLElement, actions: ChampionsActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  let activeTab = actions.activeTab ?? "champions";
  const screen = renderScreenTemplate(root, template, '[data-screen="champions"]', locale);

  const navbar = qs<HTMLElement>(screen, '[data-slot="navbar"]');
  renderNavbar(navbar, { locale, activeTab, coins: actions.coins });
  const navbarNotificationCenter = mountNavbarNotificationCenter({
    menu: screen,
    locale,
    userService: actions.userService,
    notificationService: actions.notificationService,
    initialCoins: actions.coins ?? 0
  });

  const filterLabel = qs<HTMLElement>(screen, '[data-slot="filter-label"]');
  filterLabel.textContent = t(locale, "champions.filter.allChampions");
  const filterIcon = qs<HTMLElement>(screen, '[data-slot="filter-icon"]');
  setMenuIconContent(filterIcon, "filter");

  const grid = qs<HTMLElement>(screen, '[data-slot="champion-grid"]');
  const confirmButton = qs<HTMLButtonElement>(screen, 'button[data-action="confirm"]');

  const feedbackToast = document.createElement("div");
  feedbackToast.className = "dab-toast dab-toast--champions";
  feedbackToast.setAttribute("role", "status");
  feedbackToast.setAttribute("aria-live", "polite");
  screen.appendChild(feedbackToast);

  let feedbackTimeoutId: number | null = null;

  const championCards = actions.cards.map((card) => ({ ...card }));
  let currentCoins = Math.max(0, Math.floor(actions.coins ?? 0));

  let previewSelectedChampionId: ChampionId | null =
    championCards.find((card) => card.id === actions.selectedChampionId && card.isUnlocked)?.id ??
    findFirstUnlockedChampionId(championCards);

  const clearFeedback = (): void => {
    if (feedbackTimeoutId !== null) {
      window.clearTimeout(feedbackTimeoutId);
      feedbackTimeoutId = null;
    }

    feedbackToast.classList.remove("is-visible", "is-error", "is-success");
    feedbackToast.textContent = "";
  };

  const showFeedback = (message: string, tone: "error" | "success" = "error"): void => {
    clearFeedback();
    feedbackToast.textContent = message;
    feedbackToast.classList.add("is-visible");

    if (tone === "error") {
      feedbackToast.classList.add("is-error");
    }

    if (tone === "success") {
      feedbackToast.classList.add("is-success");
    }

    feedbackTimeoutId = window.setTimeout(() => {
      clearFeedback();
    }, 2400);
  };

  const syncCoins = (nextCoins: number): void => {
    currentCoins = Math.max(0, Math.floor(nextCoins));
    navbarNotificationCenter.setCoins(currentCoins);
  };

  const selectPreviewChampion = (championId: ChampionId): void => {
    const champion = findCardById(championCards, championId);
    if (!champion || !champion.isUnlocked) {
      showFeedback(t(locale, "champions.feedback.locked"));
      return;
    }

    previewSelectedChampionId = championId;
    actions.onPreviewSelection?.(championId);
    renderGrid();
  };

  function renderGrid(): void {
    grid.replaceChildren();

    championCards.forEach((card) => {
      grid.appendChild(
        createHeroCardElement({
          locale,
          hero: card,
          isSelected: previewSelectedChampionId === card.id,
          currentCoins
        })
      );
    });

    confirmButton.disabled = previewSelectedChampionId === null;
  }

  renderGrid();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      actions.onBack();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  const cleanups = [
    bindDelegatedClick(screen, "button", (button) => {
      const tab = button.dataset.tab;
      if (isMenuTabId(tab)) {
        activeTab = tab;
        updateActiveTab(screen, activeTab);
        actions.onNavigateTab?.(tab);
        return;
      }

      const action = button.dataset.action;
      if (action === "unlock-champion") {
        const championId = button.dataset.championId as ChampionId | undefined;
        if (!championId) {
          return;
        }

        const champion = findCardById(championCards, championId);
        if (!champion) {
          showFeedback(t(locale, "champions.feedback.unlockFailed"));
          return;
        }

        const unlockResult = actions.onUnlockChampion(championId);
        if (unlockResult.user) {
          syncCoins(unlockResult.user.coins);
        }

        if (unlockResult.status === "unlocked") {
          champion.isUnlocked = true;
          previewSelectedChampionId = champion.id;
          actions.onPreviewSelection?.(champion.id);
          showFeedback(
            resolveUnlockFeedbackMessage({
              locale,
              result: unlockResult,
              heroName: champion.displayName
            }),
            "success"
          );
        } else {
          showFeedback(
            resolveUnlockFeedbackMessage({
              locale,
              result: unlockResult,
              heroName: champion.displayName
            })
          );
        }

        navbarNotificationCenter.refresh();
        renderGrid();
        return;
      }

      if (action === "confirm") {
        if (!previewSelectedChampionId) {
          return;
        }

        const selectedCard = findCardById(championCards, previewSelectedChampionId);
        if (!selectedCard || !selectedCard.isUnlocked) {
          showFeedback(t(locale, "champions.feedback.locked"));
          return;
        }

        const didSelect = actions.onConfirmSelection(previewSelectedChampionId);
        if (!didSelect) {
          showFeedback(t(locale, "champions.feedback.locked"));
        }
        return;
      }

      if (action === "back") {
        actions.onBack();
      }
    }),
    bind(screen, "click", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest("button")) {
        return;
      }

      const cardElement = target.closest<HTMLElement>(".dab-champion-card[data-champion-id]");
      if (!cardElement || !screen.contains(cardElement)) {
        return;
      }

      const championId = cardElement.dataset.championId as ChampionId | undefined;
      if (!championId) {
        return;
      }

      selectPreviewChampion(championId);
    })
  ];

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    clearFeedback();
    feedbackToast.remove();
    navbarNotificationCenter.dispose();
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}
