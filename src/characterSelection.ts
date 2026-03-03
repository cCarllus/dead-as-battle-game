import { clearElement, createButton, createTitle } from "./utils/ui";

export type CharacterId = "warrior" | "demon" | "frost";

const characters: Array<{ id: CharacterId; name: string; description: string }> = [
  { id: "warrior", name: "Warrior", description: "Equilibrado e resistente." },
  { id: "demon", name: "Demon", description: "Alto dano em curto alcance." },
  { id: "frost", name: "Frost", description: "Controle de área e mobilidade." }
];

export function renderCharacterSelection(
  root: HTMLElement,
  actions: { onSelect: (character: CharacterId) => void; onBack: () => void }
): void {
  clearElement(root);

  const container = document.createElement("section");
  container.className = "screen";

  container.appendChild(createTitle("Seleção de Personagem"));

  characters.forEach((character) => {
    const button = createButton(`${character.name} — ${character.description}`, () => {
      actions.onSelect(character.id);
    });

    container.appendChild(button);
  });

  container.appendChild(createButton("Voltar", actions.onBack));
  root.appendChild(container);
}
