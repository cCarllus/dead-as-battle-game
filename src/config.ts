import { clearElement, createButton, createTitle } from "./utils/ui";

export function renderConfig(root: HTMLElement, onBack: () => void): void {
  clearElement(root);

  const container = document.createElement("section");
  container.className = "screen";

  container.appendChild(createTitle("Configurações"));

  const details = document.createElement("p");
  details.className = "subtitle";
  details.textContent = "Tela simples para ajustes futuros (áudio, controles e gráficos).";
  container.appendChild(details);

  container.appendChild(createButton("Voltar", onBack));
  root.appendChild(container);
}
