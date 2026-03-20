import {
  AdvancedDynamicTexture
} from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Ellipse } from "@babylonjs/gui/2D/controls/ellipse";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";

import { environment } from "@/config/env";
import { GAME_CONFIG } from "@/config/game.config";
import type { GameRuntime } from "@/core/runtime/game-runtime";

export interface SceneHud {
  dispose(): void;
}

export interface SceneHudOptions {
  runtime: GameRuntime;
  sceneLabel: string;
}

export function createSceneHud(
  scene: Scene,
  options: SceneHudOptions
): SceneHud {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("scene-hud", true, scene);

  const panel = new Rectangle("status-panel");
  panel.width = "320px";
  panel.height = "148px";
  panel.thickness = 1;
  panel.color = "#6f7f95";
  panel.background = "rgba(7, 11, 17, 0.72)";
  panel.cornerRadius = 18;
  panel.paddingTop = "24px";
  panel.paddingLeft = "24px";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

  const stack = new StackPanel("status-stack");
  stack.isVertical = true;
  stack.spacing = 6;
  stack.paddingTop = "18px";
  stack.paddingLeft = "18px";
  stack.paddingRight = "18px";
  stack.paddingBottom = "18px";
  panel.addControl(stack);

  const title = new TextBlock("hud-title");
  title.text = GAME_CONFIG.appName;
  title.height = "28px";
  title.color = "#f5f7fb";
  title.fontSize = 22;
  title.fontFamily = "Avenir Next, Segoe UI, sans-serif";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

  const subtitle = new TextBlock("hud-subtitle");
  subtitle.text = `${options.sceneLabel} scene / code-first bootstrap`;
  subtitle.height = "22px";
  subtitle.color = "#94a3b8";
  subtitle.fontSize = 14;
  subtitle.fontFamily = "Avenir Next, Segoe UI, sans-serif";
  subtitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

  const fps = new TextBlock("hud-fps");
  fps.height = "22px";
  fps.color = "#7dd3fc";
  fps.fontSize = 16;
  fps.fontFamily = "Menlo, Monaco, monospace";
  fps.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  fps.isVisible = environment.showFps;

  const hint = new TextBlock("hud-hint");
  hint.text = "Drag to orbit, wheel to zoom, Alt+I for inspector";
  hint.height = "44px";
  hint.color = "#d7dde8";
  hint.fontSize = 13;
  hint.textWrapping = true;
  hint.fontFamily = "Avenir Next, Segoe UI, sans-serif";
  hint.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

  stack.addControl(title);
  stack.addControl(subtitle);
  stack.addControl(fps);
  stack.addControl(hint);
  ui.addControl(panel);

  const reticleOuter = new Ellipse("reticle-outer");
  reticleOuter.width = "28px";
  reticleOuter.height = "28px";
  reticleOuter.thickness = 2;
  reticleOuter.color = "#f5f7fb";
  reticleOuter.alpha = 0.7;
  reticleOuter.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  reticleOuter.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

  const reticleInner = new Ellipse("reticle-inner");
  reticleInner.width = "6px";
  reticleInner.height = "6px";
  reticleInner.thickness = 0;
  reticleInner.background = "#f5f7fb";
  reticleInner.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  reticleInner.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

  ui.addControl(reticleOuter);
  ui.addControl(reticleInner);

  const fpsObserver: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    fps.text = `${Math.round(options.runtime.engine.getFps())} FPS`;
  });

  return {
    dispose(): void {
      scene.onBeforeRenderObservable.remove(fpsObserver);
      ui.dispose();
    }
  };
}
