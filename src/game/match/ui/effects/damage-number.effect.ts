// Responsável por renderizar números de dano flutuantes em camada de UI com animação de subida e fade.
export type DamageNumberEffect = {
  show: (options: { value: number; x: number; y: number; wasBlocked?: boolean }) => void;
  dispose: () => void;
};

export type CreateDamageNumberEffectOptions = {
  container: HTMLElement;
};

const DAMAGE_NUMBER_LIFETIME_MS = 700;
const DAMAGE_NUMBER_RISE_PX = 46;

export function createDamageNumberEffect(options: CreateDamageNumberEffectOptions): DamageNumberEffect {
  const activeFrames = new Set<number>();

  options.container.style.pointerEvents = "none";
  options.container.style.position = "absolute";
  options.container.style.inset = "0";
  options.container.style.overflow = "hidden";

  const show = (payload: { value: number; x: number; y: number; wasBlocked?: boolean }): void => {
    const numberNode = document.createElement("div");
    numberNode.textContent = String(Math.max(0, Math.floor(payload.value)));
    numberNode.style.position = "absolute";
    numberNode.style.left = `${payload.x}px`;
    numberNode.style.top = `${payload.y}px`;
    numberNode.style.transform = "translate(-50%, -50%)";
    numberNode.style.fontFamily = "Rajdhani, sans-serif";
    numberNode.style.fontSize = payload.wasBlocked ? "22px" : "26px";
    numberNode.style.fontWeight = "700";
    numberNode.style.letterSpacing = "0.02em";
    numberNode.style.color = payload.wasBlocked ? "#7dd3fc" : "#fca5a5";
    numberNode.style.textShadow = "0 0 12px rgba(0, 0, 0, 0.65)";
    numberNode.style.opacity = "1";
    numberNode.style.userSelect = "none";
    numberNode.style.willChange = "transform, opacity";
    options.container.appendChild(numberNode);

    const startedAt = performance.now();

    const animate = (now: number): void => {
      const elapsed = now - startedAt;
      const progress = Math.max(0, Math.min(1, elapsed / DAMAGE_NUMBER_LIFETIME_MS));

      const translateY = -progress * DAMAGE_NUMBER_RISE_PX;
      const scale = payload.wasBlocked ? 0.96 + (1 - progress) * 0.05 : 1 + (1 - progress) * 0.08;
      numberNode.style.transform = `translate(-50%, calc(-50% + ${translateY}px)) scale(${scale})`;
      numberNode.style.opacity = `${1 - progress}`;

      if (progress >= 1) {
        numberNode.remove();
        return;
      }

      const frameId = window.requestAnimationFrame((nextNow) => {
        activeFrames.delete(frameId);
        animate(nextNow);
      });
      activeFrames.add(frameId);
    };

    const firstFrameId = window.requestAnimationFrame((nextNow) => {
      activeFrames.delete(firstFrameId);
      animate(nextNow);
    });
    activeFrames.add(firstFrameId);
  };

  return {
    show,
    dispose: () => {
      activeFrames.forEach((frameId) => {
        window.cancelAnimationFrame(frameId);
      });
      activeFrames.clear();
      options.container.replaceChildren();
    }
  };
}
