export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = "menu-button";
  button.addEventListener("click", onClick);
  return button;
}

export function createTitle(text: string): HTMLHeadingElement {
  const title = document.createElement("h1");
  title.textContent = text;
  title.className = "screen-title";
  return title;
}

export function injectGlobalStyles(): void {
  const styleId = "dead-as-battle-styles";

  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      font-family: Arial, sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      overflow: hidden;
    }

    #renderCanvas {
      width: 100%;
      height: 100%;
      display: block;
      position: fixed;
      inset: 0;
      z-index: 0;
      background: radial-gradient(circle at top, #222, #070707);
    }

    #ui-root {
      position: fixed;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .screen {
      min-width: 320px;
      max-width: 540px;
      padding: 24px;
      border-radius: 16px;
      backdrop-filter: blur(4px);
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.2);
      pointer-events: auto;
      text-align: center;
    }

    .screen-title {
      margin: 0 0 20px;
      font-size: 2rem;
    }

    .menu-button {
      width: 100%;
      margin: 8px 0;
      padding: 12px;
      border: none;
      border-radius: 10px;
      background: #4b76ff;
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .menu-button:hover {
      background: #3a5fcc;
    }

    .subtitle {
      margin: 0 0 16px;
      color: #d0d0d0;
    }
  `;

  document.head.appendChild(style);
}
