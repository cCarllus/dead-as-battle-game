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

    .dab-menu,
    .dab-menu * {
      box-sizing: border-box;
    }

    .dab-menu {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: auto;
      color: #f5f7ff;
      display: flex;
      flex-direction: column;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background: radial-gradient(circle at 22% 18%, #25386d 0%, #0f1421 40%, #07090f 100%);
    }

    .dab-menu__bg {
      position: absolute;
      inset: -5%;
      background:
        radial-gradient(circle at 80% 15%, rgba(90, 36, 182, 0.35), transparent 45%),
        radial-gradient(circle at 12% 85%, rgba(15, 164, 208, 0.35), transparent 50%),
        linear-gradient(145deg, #0f1628 0%, #0b111f 42%, #07090f 100%);
      transform: scale(1.06) translate(0, 0);
      transition: transform 180ms linear;
    }

    .dab-menu__aurora {
      position: absolute;
      width: 480px;
      height: 480px;
      border-radius: 999px;
      filter: blur(90px);
      opacity: 0.35;
      pointer-events: none;
    }

    .dab-menu__aurora--left {
      left: -180px;
      bottom: -140px;
      background: #00cfff;
    }

    .dab-menu__aurora--right {
      right: -120px;
      top: 100px;
      background: #6f54ff;
    }

    .dab-menu__header {
      position: relative;
      z-index: 3;
      height: 72px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 20px;
      padding: 0 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      background: rgba(0, 0, 0, 0.32);
    }

    .dab-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 120px;
    }

    .dab-logo__mark {
      width: 15px;
      height: 15px;
      transform: rotate(45deg);
      border: 2px solid #f7c74e;
      box-shadow: 0 0 16px rgba(247, 199, 78, 0.6);
    }

    .dab-logo__text {
      font-weight: 700;
      letter-spacing: 0.04em;
      font-size: 1.15rem;
    }

    .dab-logo__text span {
      color: #00d8ff;
    }

    .dab-menu__nav {
      display: flex;
      align-items: stretch;
      justify-content: center;
      gap: 6px;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .dab-menu__nav::-webkit-scrollbar {
      display: none;
    }

    .dab-menu__nav-btn {
      border: 0;
      color: rgba(255, 255, 255, 0.65);
      background: transparent;
      padding: 0 16px;
      min-height: 72px;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: color 180ms ease, background-color 180ms ease;
    }

    .dab-menu__nav-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }

    .dab-menu__nav-btn.is-active {
      color: #ffd65f;
      box-shadow: inset 0 -2px 0 #ffd65f;
      background: rgba(255, 255, 255, 0.08);
      text-shadow: 0 0 8px rgba(255, 214, 95, 0.5);
    }

    .dab-menu__tools {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    .dab-icon-button {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.95rem;
      cursor: pointer;
      transition: border-color 180ms ease, background-color 180ms ease;
    }

    .dab-icon-button:hover {
      border-color: rgba(255, 255, 255, 0.45);
      background: rgba(255, 255, 255, 0.12);
    }

    .dab-currency {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.08);
      padding: 6px 12px;
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .dab-avatar {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: linear-gradient(145deg, #8e45ff, #2f74ff);
      font-size: 0.8rem;
      font-weight: 700;
      display: grid;
      place-items: center;
    }

    .dab-menu__watermark {
      position: absolute;
      top: 90px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      opacity: 0.18;
      pointer-events: none;
      z-index: 1;
    }

    .dab-menu__watermark h1 {
      margin: 0;
      font-size: clamp(2.5rem, 8vw, 5.5rem);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .dab-menu__watermark p {
      margin: 0;
      font-size: clamp(0.85rem, 3vw, 1.4rem);
      letter-spacing: 0.3em;
      color: #00dbff;
      font-weight: 700;
    }

    .dab-menu__hero {
      position: absolute;
      left: 50%;
      bottom: 30px;
      width: min(35vw, 420px);
      height: min(75vh, 640px);
      transform: translate(0, 0);
      transition: transform 180ms linear;
      filter: drop-shadow(-24px 0 26px rgba(0, 0, 0, 0.45));
      pointer-events: none;
      z-index: 2;
    }

    .dab-menu__hero-core {
      position: absolute;
      inset: 0;
      clip-path: polygon(48% 0%, 65% 14%, 76% 38%, 90% 60%, 88% 100%, 15% 100%, 10% 60%, 24% 40%, 36% 14%);
      background:
        linear-gradient(180deg, rgba(190, 226, 255, 0.62) 0%, rgba(58, 172, 255, 0.34) 42%, rgba(10, 13, 24, 0.12) 100%);
      border: 1px solid rgba(255, 255, 255, 0.22);
      box-shadow:
        inset 0 0 90px rgba(0, 219, 255, 0.22),
        0 0 80px rgba(0, 56, 157, 0.35);
    }

    .dab-menu__main {
      position: relative;
      z-index: 4;
      flex: 1;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      gap: 24px;
      overflow: auto;
    }

    .dab-roster {
      width: min(340px, 36vw);
      min-width: 260px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-self: flex-end;
      margin-bottom: 14px;
    }

    .dab-roster__title {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding-left: 4px;
    }

    .dab-roster__title h2 {
      margin: 0;
      letter-spacing: 0.06em;
      font-size: 1.6rem;
      font-style: italic;
    }

    .dab-roster__title span {
      color: rgba(255, 255, 255, 0.58);
      font-weight: 700;
    }

    .dab-roster__slot {
      min-height: 56px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.07);
      color: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      clip-path: polygon(7% 0%, 100% 0%, 93% 100%, 0% 100%);
      transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease;
    }

    .dab-roster__slot:hover {
      transform: translateX(3px);
      border-color: rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.13);
    }

    .dab-roster__slot span {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .dab-roster__slot small {
      color: rgba(255, 255, 255, 0.62);
      font-size: 0.7rem;
      font-weight: 600;
    }

    .dab-roster__slot--self {
      background: linear-gradient(90deg, rgba(255, 210, 64, 0.9), rgba(255, 177, 47, 0.92));
      color: #1a1609;
      border-color: rgba(255, 240, 188, 0.65);
    }

    .dab-roster__slot--self small {
      color: rgba(26, 22, 9, 0.75);
    }

    .dab-roster__slot--empty {
      justify-content: center;
      text-align: center;
      font-size: 1.4rem;
      font-weight: 300;
      color: rgba(255, 255, 255, 0.55);
    }

    .dab-roster__status {
      width: 7px;
      min-width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #3df47e;
      box-shadow: 0 0 10px rgba(61, 244, 126, 0.8);
      align-self: center;
    }

    .dab-play {
      width: min(390px, 44vw);
      min-width: 260px;
      margin-top: auto;
      margin-left: auto;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      padding-bottom: 14px;
    }

    .dab-link {
      align-self: flex-end;
      border: 0;
      background: transparent;
      color: rgba(255, 255, 255, 0.65);
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      font-weight: 700;
      cursor: pointer;
      transition: color 160ms ease;
    }

    .dab-link:hover {
      color: #fff;
    }

    .dab-play__promo {
      border: 0;
      color: #13100a;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: linear-gradient(90deg, #f0b642 0%, #f6d666 100%);
      cursor: pointer;
      clip-path: polygon(0 0, 90% 0, 100% 100%, 10% 100%);
      transition: filter 160ms ease;
    }

    .dab-play__promo:hover {
      filter: brightness(1.07);
    }

    .dab-play__card {
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: linear-gradient(140deg, rgba(94, 112, 180, 0.86), rgba(61, 73, 130, 0.92));
      clip-path: polygon(0 0, 92% 0, 100% 100%, 8% 100%);
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(5, 8, 20, 0.52);
    }

    .dab-play__mode {
      padding: 20px 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dab-play__mode h3 {
      margin: 0;
      font-size: clamp(1.4rem, 4vw, 2.2rem);
      letter-spacing: 0.05em;
      font-style: italic;
      text-shadow: 0 0 18px rgba(110, 228, 255, 0.45);
    }

    .dab-play__start {
      width: 100%;
      border: 0;
      background: #ffd24d;
      color: #19140a;
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: 0.15em;
      padding: 14px;
      cursor: pointer;
      transition: background-color 160ms ease;
    }

    .dab-play__start:hover {
      background: #ffe07d;
    }

    .dab-play__status {
      align-self: flex-end;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.62);
      letter-spacing: 0.06em;
      font-weight: 700;
    }

    .dab-menu__footer {
      position: relative;
      z-index: 4;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6));
      backdrop-filter: blur(8px);
    }

    .dab-chat-button,
    .dab-footer-button {
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.07);
      color: rgba(255, 255, 255, 0.78);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      font-weight: 700;
      padding: 7px 12px;
      cursor: pointer;
      transition: background-color 150ms ease, color 150ms ease;
    }

    .dab-chat-button:hover,
    .dab-footer-button:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.15);
    }

    .dab-footer-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    @media (max-width: 1080px) {
      .dab-menu__header {
        grid-template-columns: auto 1fr auto;
        gap: 14px;
        padding: 0 14px;
      }

      .dab-menu__main {
        padding: 20px 14px;
      }

      .dab-roster,
      .dab-play {
        width: min(360px, 100%);
      }
    }

    @media (max-width: 920px) {
      .dab-menu__hero {
        opacity: 0.45;
        left: 58%;
        width: min(46vw, 300px);
      }

      .dab-menu__main {
        flex-direction: column;
      }

      .dab-roster {
        margin: 0;
      }

      .dab-play {
        margin-left: 0;
      }
    }

    @media (max-width: 680px) {
      .dab-menu__header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        height: auto;
        padding: 8px 10px 10px;
      }

      .dab-menu__nav {
        order: 3;
        width: 100%;
        justify-content: flex-start;
      }

      .dab-menu__nav-btn {
        min-height: 44px;
        padding: 0 12px;
      }

      .dab-menu__hero {
        display: none;
      }

      .dab-menu__main {
        padding: 14px 10px;
      }

      .dab-roster,
      .dab-play {
        min-width: 0;
        width: 100%;
      }

      .dab-menu__footer {
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
      }

      .dab-footer-actions {
        justify-content: flex-end;
      }
    }
  `;

  document.head.appendChild(style);
}
