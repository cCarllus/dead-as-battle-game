import { clearElement, createButton, createTitle } from "./utils/ui";

export type MenuActions = {
  onOpenConfig: () => void;
  onOpenMultiplayer: () => void;
  onExit: () => void;
};

export function renderMenu(root: HTMLElement, actions: MenuActions): void {
  clearElement(root);

  const container = document.createElement("section");
  container.className = "screen";

  container.appendChild(createTitle("Dead as Battle"));

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Menu principal";
  container.appendChild(subtitle);

  container.appendChild(createButton("Configurações", actions.onOpenConfig));
  container.appendChild(createButton("Multiplayer (Local)", actions.onOpenMultiplayer));
  container.appendChild(createButton("Sair", actions.onExit));

  root.appendChild(container);
}
