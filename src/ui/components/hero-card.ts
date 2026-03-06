// Responsável por renderizar o card visual de herói com estados de bloqueio, seleção e compra.
import { t, type Locale } from "../../i18n";
import type { ChampionId } from "../../models/champion.model";

function formatCoins(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.floor(value)));
}

export type HeroCardData = {
  id: ChampionId;
  displayName: string;
  universeName: string;
  level: number;
  isUnlocked: boolean;
  isDefault: boolean;
  priceCoins: number;
  imageUrl: string;
  themeColor: string;
};

export type HeroCardOptions = {
  locale: Locale;
  hero: HeroCardData;
  isSelected: boolean;
  currentCoins: number;
};

export function createHeroCardElement(options: HeroCardOptions): HTMLElement {
  const card = document.createElement("article");
  card.className = "dab-champion-card";
  card.dataset.championId = options.hero.id;
  card.style.setProperty("--dab-card-theme", options.hero.themeColor);

  if (options.isSelected) {
    card.classList.add("is-selected");
  }

  if (!options.hero.isUnlocked) {
    card.classList.add("dab-champion-card--locked");
  }

  const image = document.createElement("img");
  image.className = "dab-champion-card__image";
  image.src = options.hero.imageUrl;
  image.alt = options.hero.displayName;
  image.loading = "lazy";

  const level = document.createElement("span");
  level.className = "dab-champion-card__level";
  level.textContent = t(options.locale, "champions.level", { value: options.hero.level });

  const check = document.createElement("span");
  check.className = "dab-champion-card__check";
  check.textContent = "✓";

  const footer = document.createElement("span");
  footer.className = "dab-champion-card__footer";

  const title = document.createElement("strong");
  title.textContent = options.hero.displayName;

  const subtitle = document.createElement("small");
  subtitle.textContent = options.hero.universeName;

  footer.append(title, subtitle);

  let actionLayer: HTMLElement | null = null;

  if (!options.hero.isUnlocked) {
    const lockActions = document.createElement("div");
    lockActions.className = "dab-champion-card__actions";

    const lockPanel = document.createElement("div");
    lockPanel.className = "dab-champion-card__lock-panel";

    const lockIcon = document.createElement("span");
    lockIcon.className = "dab-champion-card__lock-icon";
    lockIcon.setAttribute("aria-hidden", "true");
    lockIcon.textContent = "🔒";

    const lockText = document.createElement("span");
    lockText.className = "dab-champion-card__locked-text";
    lockText.textContent = t(options.locale, "champions.locked");

    const price = document.createElement("span");
    price.className = "dab-champion-card__price";
    price.textContent = t(options.locale, "champions.priceCoins", {
      value: formatCoins(options.locale, options.hero.priceCoins)
    });

    const unlockButton = document.createElement("button");
    unlockButton.type = "button";
    unlockButton.className = "dab-champion-card__action dab-champion-card__action--unlock";
    unlockButton.dataset.action = "unlock-champion";
    unlockButton.dataset.championId = options.hero.id;
    if (options.currentCoins < options.hero.priceCoins) {
      unlockButton.classList.add("is-insufficient");
    }
    unlockButton.textContent = t(options.locale, "champions.unlock");

    lockPanel.append(lockIcon, lockText, price, unlockButton);
    lockActions.appendChild(lockPanel);
    actionLayer = lockActions;
  }

  card.append(image, level, check, footer);
  if (actionLayer) {
    card.append(actionLayer);
  }
  return card;
}
