// Responsável por renderizar a tela de campeões e suas interações principais.
import type { Locale, TranslationKey } from "../../i18n";
import { t } from "../../i18n";
import template from "../layout/champions.html?raw";
import { bindDelegatedClick, qs } from "../components/dom";
import { renderNavbar } from "../components/navbar";
import { MENU_NAV_ITEMS, type MenuTabId } from "../navigation/menu.model";
import {
  CHAMPION_FILTER_ITEMS,
  CHAMPION_ROSTER,
  LOCKED_SLOT_COUNT,
  isChampionUniverseId,
  type ChampionUniverseId,
  type ChampionRosterItem
} from "./champions.model";
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

function resolveUniverseLabelKey(universeId: ChampionUniverseId): TranslationKey {
  switch (universeId) {
    case "all":
      return "champions.filter.allUniverses";
    case "jujutsu-kaisen":
      return "champions.universe.jujutsuKaisen";
    case "kaiju_no_8":
      return "champions.universe.kaijuNo8";
    default:
      return "champions.filter.allUniverses";
  }
}

function createChampionCard(params: {
  locale: Locale;
  item: ChampionRosterItem;
  selectedChampionId: string | null;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dab-champion-card";
  button.dataset.action = "select-champion";
  button.dataset.championId = params.item.id;

  if (params.selectedChampionId === params.item.id) {
    button.classList.add("is-selected");
  }

  if (params.item.accent === "gold") {
    button.classList.add("is-legendary");
  }

  const image = document.createElement("img");
  image.className = "dab-champion-card__image";
  image.src = params.item.imageUrl;
  image.alt = params.item.name;
  image.loading = "lazy";

  const level = document.createElement("span");
  level.className = "dab-champion-card__level";
  level.textContent = t(params.locale, "champions.level", { value: params.item.level });

  const footer = document.createElement("span");
  footer.className = "dab-champion-card__footer";

  const title = document.createElement("strong");
  title.textContent = params.item.name;

  const role = document.createElement("small");
  role.textContent = t(params.locale, resolveUniverseLabelKey(params.item.universeId));

  footer.append(title, role);
  button.append(image, level, footer);

  return button;
}

function createLockedCard(locale: Locale): HTMLDivElement {
  const locked = document.createElement("div");
  locked.className = "dab-champion-card dab-champion-card--locked";

  const text = document.createElement("span");
  text.className = "dab-champion-card__locked-text";
  text.textContent = t(locale, "champions.locked");

  const footer = document.createElement("span");
  footer.className = "dab-champion-card__footer";

  const footerLine = document.createElement("span");
  footerLine.className = "dab-champion-card__locked-line";

  footer.appendChild(footerLine);
  locked.append(text, footer);

  return locked;
}

function resolveFilteredRoster(filter: ChampionUniverseId): readonly ChampionRosterItem[] {
  if (filter === "all") {
    return CHAMPION_ROSTER;
  }

  return CHAMPION_ROSTER.filter((item) => item.universeId === filter);
}

export type ChampionsActions = {
  locale?: Locale;
  activeTab?: MenuTabId;
  onNavigateTab?: (tab: MenuTabId) => void;
  onBack: () => void;
  onConfirmSelection?: (championId: string) => void;
};

export function renderChampionsScreen(root: HTMLElement, actions: ChampionsActions): () => void {
  const locale = resolveScreenLocale(actions.locale);
  let activeTab = actions.activeTab ?? "champions";
  const screen = renderScreenTemplate(root, template, '[data-screen="champions"]', locale);

  const navbar = qs<HTMLElement>(screen, '[data-slot="navbar"]');
  renderNavbar(navbar, { locale, activeTab });

  const filterLabel = qs<HTMLElement>(screen, '[data-slot="filter-label"]');
  const filterOptions = qs<HTMLElement>(screen, '[data-slot="filter-options"]');
  const grid = qs<HTMLElement>(screen, '[data-slot="champion-grid"]');
  const confirmButton = qs<HTMLButtonElement>(screen, 'button[data-action="confirm"]');

  let activeFilter: ChampionUniverseId = "all";
  let selectedChampionId: string | null = CHAMPION_ROSTER[0]?.id ?? null;
  let isFilterOpen = false;

  function renderFilter(): void {
    filterLabel.textContent = t(locale, resolveUniverseLabelKey(activeFilter));
    filterOptions.hidden = !isFilterOpen;
    filterOptions.replaceChildren();

    CHAMPION_FILTER_ITEMS.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dab-champions__filter-option";
      button.dataset.action = "set-filter";
      button.dataset.filter = item.id;
      button.textContent = t(locale, item.labelKey);

      if (item.id === activeFilter) {
        button.classList.add("is-active");
      }

      filterOptions.appendChild(button);
    });
  }

  function ensureVisibleSelection(visibleRoster: readonly ChampionRosterItem[]): void {
    const isSelectedVisible = visibleRoster.some((item) => item.id === selectedChampionId);
    if (isSelectedVisible) {
      return;
    }

    selectedChampionId = visibleRoster[0]?.id ?? null;
  }

  function renderGrid(): void {
    const visibleRoster = resolveFilteredRoster(activeFilter);
    ensureVisibleSelection(visibleRoster);

    grid.replaceChildren();

    visibleRoster.forEach((item) => {
      grid.appendChild(
        createChampionCard({
          locale,
          item,
          selectedChampionId
        })
      );
    });

    if (activeFilter === "all") {
      for (let index = 0; index < LOCKED_SLOT_COUNT; index += 1) {
        grid.appendChild(createLockedCard(locale));
      }
    }

    confirmButton.disabled = selectedChampionId === null;
  }

  function render(): void {
    renderFilter();
    renderGrid();
  }

  render();

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
      if (action === "toggle-filter") {
        isFilterOpen = !isFilterOpen;
        renderFilter();
        return;
      }

      if (action === "set-filter") {
        const filter = button.dataset.filter;
        if (!isChampionUniverseId(filter)) {
          return;
        }

        activeFilter = filter;
        isFilterOpen = false;
        render();
        return;
      }

      if (action === "select-champion") {
        const championId = button.dataset.championId;
        if (!championId) {
          return;
        }

        selectedChampionId = championId;
        renderGrid();
        return;
      }

      if (action === "confirm") {
        if (selectedChampionId) {
          actions.onConfirmSelection?.(selectedChampionId);
        }
        return;
      }

      if (action === "back") {
        actions.onBack();
      }
    })
  ];

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}
