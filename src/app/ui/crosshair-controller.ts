// Responsible for keeping the HUD crosshair aligned with the shoulder-camera screen anchor.
export type CrosshairFrameState = {
  normalizedX: number;
  normalizedY: number;
  scale: number;
  opacity: number;
  visible: boolean;
};

export type CrosshairController = {
  dispose: () => void;
};

export type CreateCrosshairControllerOptions = {
  element: HTMLElement;
  resolveState: () => CrosshairFrameState | null;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function createCrosshairController(
  options: CreateCrosshairControllerOptions
): CrosshairController {
  let frameId: number | null = null;
  const render = (): void => {
    const state = options.resolveState();
    if (!state || !state.visible) {
      options.element.hidden = true;
      frameId = window.requestAnimationFrame(render);
      return;
    }

    options.element.hidden = false;
    options.element.style.setProperty("--dab-crosshair-x", `${(clamp01(state.normalizedX) * 100).toFixed(3)}%`);
    options.element.style.setProperty("--dab-crosshair-y", `${(clamp01(state.normalizedY) * 100).toFixed(3)}%`);
    options.element.style.setProperty(
      "--dab-crosshair-scale",
      clampPositive(state.scale, 1).toFixed(3)
    );
    options.element.style.setProperty(
      "--dab-crosshair-opacity",
      clamp01(state.opacity).toFixed(3)
    );

    frameId = window.requestAnimationFrame(render);
  };

  render();

  return {
    dispose: () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    }
  };
}
