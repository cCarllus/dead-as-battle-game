import template from "../layout/lobby.html?raw";
import { resolveLocale, t, type Locale, type TranslationKey } from "../../i18n";
import type { CharacterId } from "../../game/entities/player/player.types";
import { clearElement, hydrateI18n, qs } from "../components/dom";

const CHARACTER_NAME_KEYS: Record<CharacterId, TranslationKey> = {
  ryomen_sukuna: "character.ryomen_sukuna.name",
  kaiju_n8: "character.kaiju_n8.name",
  ainz_ooal_gown: "character.ainz_ooal_gown.name"
};

export type LobbyActions = {
  locale?: Locale;
  selectedCharacter: CharacterId;
  onStart: () => void;
  onChangeCharacter: () => void;
  onBack: () => void;
};

export function renderLobbyScreen(root: HTMLElement, actions: LobbyActions): () => void {
  const locale = resolveLocale(actions.locale ?? document.documentElement.lang);

  clearElement(root);
  root.innerHTML = template;

  const screen = qs<HTMLElement>(root, '[data-screen="lobby"]');
  hydrateI18n(screen, locale);

  const selection = qs<HTMLElement>(screen, '[data-slot="selection"]');
  selection.textContent = t(locale, "lobby.currentCharacter", {
    value: t(locale, CHARACTER_NAME_KEYS[actions.selectedCharacter])
  });

  const abortController = new AbortController();
  screen.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("button[data-action]");
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      if (action === "start") {
        actions.onStart();
        return;
      }

      if (action === "change") {
        actions.onChangeCharacter();
        return;
      }

      if (action === "back") {
        actions.onBack();
      }
    },
    { signal: abortController.signal }
  );

  return () => abortController.abort();
}
