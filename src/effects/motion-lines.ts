// Responsável por exibir linhas de velocidade sutis na HUD durante sprint de alta velocidade.
export type MotionLinesInput = {
  deltaSeconds: number;
  intensity: number;
  enabled: boolean;
};

export type MotionLinesEffect = {
  update: (input: MotionLinesInput) => void;
  dispose: () => void;
};

function ensureParentIsPositioned(parent: HTMLElement): void {
  const computed = window.getComputedStyle(parent);
  if (computed.position === "static") {
    parent.style.position = "relative";
  }
}

export function createMotionLinesEffect(canvas: HTMLCanvasElement): MotionLinesEffect {
  const parent = canvas.parentElement;
  if (!parent) {
    return {
      update: () => {
        // no-op when canvas has no parent in DOM
      },
      dispose: () => {
        // no-op
      }
    };
  }

  ensureParentIsPositioned(parent);

  const overlay = document.createElement("div");
  overlay.dataset.slot = "gamefeel-motion-lines";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 90ms linear";
  overlay.style.mixBlendMode = "screen";
  overlay.style.background = [
    "linear-gradient(90deg, rgba(180,220,255,0.42) 0%, rgba(180,220,255,0) 14%)",
    "linear-gradient(270deg, rgba(180,220,255,0.42) 0%, rgba(180,220,255,0) 14%)",
    "linear-gradient(0deg, rgba(130,170,220,0.08) 0%, rgba(130,170,220,0) 26%)"
  ].join(",");
  parent.appendChild(overlay);

  let currentOpacity = 0;

  return {
    update: (input) => {
      const targetOpacity = input.enabled ? Math.max(0, Math.min(0.58, input.intensity * 0.58)) : 0;
      currentOpacity += (targetOpacity - currentOpacity) * Math.min(1, 9 * Math.max(0, input.deltaSeconds));
      overlay.style.opacity = currentOpacity.toFixed(3);
    },
    dispose: () => {
      overlay.remove();
    }
  };
}
