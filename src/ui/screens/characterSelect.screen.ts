import template from "../layout/characterSelect.html?raw";
import { resolveLocale, t, type Locale, type TranslationKey } from "../../i18n";
import type { CharacterId } from "../../game/entities/player/player.types";
import { clearElement, hydrateI18n, qs } from "../components/dom";

type CharacterCard = {
  id: CharacterId;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
};

const CHARACTERS: readonly CharacterCard[] = [
  {
    id: "ryomen_sukuna",
    nameKey: "character.ryomen_sukuna.name",
    descriptionKey: "character.ryomen_sukuna.description"
  },
  {
    id: "kaiju_n8",
    nameKey: "character.kaiju_n8.name",
    descriptionKey: "character.kaiju_n8.description"
  },
  {
    id: "ainz_ooal_gown",
    nameKey: "character.ainz_ooal_gown.name",
    descriptionKey: "character.ainz_ooal_gown.description"
  }
];

export type CharacterSelectActions = {
  locale?: Locale;
  onBack: () => void;
  onSelect: (character: CharacterId) => void;
};

export function renderCharacterSelectScreen(root: HTMLElement, actions: CharacterSelectActions): () => void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);

  clearElement(root);
  root.innerHTML = template;

  const screen = qs<HTMLElement>(root, '[data-screen="character-select"]');
  hydrateI18n(screen, locale);

  const list = qs<HTMLElement>(screen, '[data-slot="characters"]');
  CHARACTERS.forEach((character) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-button";
    button.dataset.characterId = character.id;
    button.textContent = `${t(locale, character.nameKey)} - ${t(locale, character.descriptionKey)}`;
    list.appendChild(button);
  });

  const abortController = new AbortController();
  const { signal } = abortController;

  screen.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("button");
      if (!button || !screen.contains(button)) {
        return;
      }

      const characterId = button.dataset.characterId;
      if (
        characterId === "ryomen_sukuna" ||
        characterId === "kaiju_n8" ||
        characterId === "ainz_ooal_gown"
      ) {
        actions.onSelect(characterId as CharacterId);
        return;
      }

      if (button.dataset.action === "back") {
        actions.onBack();
      }
    },
    { signal }
  );

  return () => abortController.abort();
}
