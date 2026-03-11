import { createMenuIcon } from "./menu-icon";

export type MenuLogoVariant = "full" | "compact";

export type MenuLogoOptions = {
  variant?: MenuLogoVariant;
};

export function renderMenuLogo(options: MenuLogoOptions = {}): HTMLElement {
  const variant = options.variant ?? "full";
  const logo = document.createElement("div");
  logo.className = "dab-logo";
  logo.dataset.variant = variant;
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", "Dead As Battle");

  const crest = document.createElement("span");
  crest.className = "dab-logo__crest";

  const crestCut = document.createElement("span");
  crestCut.className = "dab-logo__crest-cut";

  const crestCopy = document.createElement("span");
  crestCopy.className = "dab-logo__crest-copy";
  crestCopy.textContent = variant === "compact" ? "DAB" : "DA";

  crest.append(createMenuIcon("wordmarkAccent", { className: "dab-logo__crest-icon" }), crestCut, crestCopy);
  logo.appendChild(crest);

  const copy = document.createElement("span");
  copy.className = "dab-logo__copy";

  const eyebrow = document.createElement("span");
  eyebrow.className = "dab-logo__eyebrow";
  eyebrow.textContent = "MULTIPLAYER HERO FIGHTER";

  const wordmark = document.createElement("span");
  wordmark.className = "dab-logo__wordmark";

  if (variant === "compact") {
    const compactWord = document.createElement("span");
    compactWord.className = "dab-logo__compact-word";
    compactWord.textContent = "DEAD AS BATTLE";
    wordmark.appendChild(compactWord);
  } else {
    const dead = document.createElement("span");
    dead.className = "dab-logo__word dab-logo__word--dead";
    dead.textContent = "DEAD";

    const as = document.createElement("span");
    as.className = "dab-logo__word dab-logo__word--accent";
    as.textContent = "AS";

    const battle = document.createElement("span");
    battle.className = "dab-logo__word dab-logo__word--battle";
    battle.textContent = "BATTLE";

    wordmark.append(dead, as, battle);
  }

  copy.append(eyebrow, wordmark);
  logo.appendChild(copy);

  return logo;
}
