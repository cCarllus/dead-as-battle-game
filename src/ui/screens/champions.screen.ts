// Responsável por renderizar a tela de campeões com seleção persistente por usuário.
import { t, type Locale } from "../../i18n";
import type { ChampionId } from "../../models/champion.model";
import template from "../layout/champions.html?raw";
import { bindDelegatedClick, qs } from "../components/dom";
import { renderNavbar } from "../components/navbar";
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

export type ChampionSelectionCard = {
  id: ChampionId;
  displayName: string;
  universeName: string;
  level: number;
  imageUrl: string;
  themeColor: string;
};

function createChampionCard(params: {
  locale: Locale;
  card: ChampionSelectionCard;
  selectedChampionId: ChampionId | null;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dab-champion-card";
  button.dataset.action = "select-champion";
  button.dataset.championId = params.card.id;
  button.style.setProperty("--dab-card-theme", params.card.themeColor);

  if (params.selectedChampionId === params.card.id) {
    button.classList.add("is-selected");
  }

  const image = document.createElement("img");
  image.className = "dab-champion-card__image";
  image.src = params.card.imageUrl;
  image.alt = params.card.displayName;
  image.loading = "lazy";

  const level = document.createElement("span");
  level.className = "dab-champion-card__level";
  level.textContent = t(params.locale, "champions.level", { value: params.card.level });

  const check = document.createElement("span");
  check.className = "dab-champion-card__check";
  check.textContent = "✓";

  const footer = document.createElement("span");
  footer.className = "dab-champion-card__footer";

  const title = document.createElement("strong");
  title.textContent = params.card.displayName;

  const subtitle = document.createElement("small");
  subtitle.textContent = params.card.universeName;

  footer.append(title, subtitle);
  button.append(image, level, check, footer);

  return button;
}

export type ChampionsActions = {
  locale?: Locale;
  activeTab?: MenuTabId;
  cards: readonly ChampionSelectionCard[];
  selectedChampionId: ChampionId;
  onNavigateTab?: (tab: MenuTabId) => void;
  onConfirmSelection: (championId: ChampionId) => void;
  onBack: () => void;
};

export function renderChampionsScreen(root: HTMLElement, actions: ChampionsActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  let activeTab = actions.activeTab ?? "champions";
  const screen = renderScreenTemplate(root, template, '[data-screen="champions"]', locale);

  const navbar = qs<HTMLElement>(screen, '[data-slot="navbar"]');
  renderNavbar(navbar, { locale, activeTab });

  const filterLabel = qs<HTMLElement>(screen, '[data-slot="filter-label"]');
  filterLabel.textContent = t(locale, "champions.filter.allChampions");

  const grid = qs<HTMLElement>(screen, '[data-slot="champion-grid"]');
  const confirmButton = qs<HTMLButtonElement>(screen, 'button[data-action="confirm"]');

  let previewSelectedChampionId: ChampionId | null =
    actions.selectedChampionId ?? actions.cards[0]?.id ?? null;

  function renderGrid(): void {
    grid.replaceChildren();

    actions.cards.forEach((card) => {
      grid.appendChild(
        createChampionCard({
          locale,
          card,
          selectedChampionId: previewSelectedChampionId
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
      if (action === "select-champion") {
        const championId = button.dataset.championId as ChampionId | undefined;
        if (!championId) {
          return;
        }

        previewSelectedChampionId = championId;
        renderGrid();
        return;
      }

      if (action === "confirm") {
        if (previewSelectedChampionId) {
          actions.onConfirmSelection(previewSelectedChampionId);
        }
        return;
      }

      if (action === "back") {
        actions.onBack();
      }
    })
  ];

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}
