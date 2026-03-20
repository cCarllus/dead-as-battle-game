import "@babylonjs/core/Debug/debugLayer";
import type { Scene } from "@babylonjs/core/scene";

import { environment } from "@/config/env";

export interface DebugToolsHandle {
  dispose(): void;
}

let inspectorReady = false;

async function ensureInspectorLoaded(): Promise<void> {
  if (!import.meta.env.DEV) {
    return;
  }

  if (inspectorReady) {
    return;
  }

  await import("@babylonjs/inspector");
  inspectorReady = true;
}

async function toggleInspector(scene: Scene, forceOpen = false): Promise<void> {
  await ensureInspectorLoaded();

  if (scene.debugLayer.isVisible() && !forceOpen) {
    scene.debugLayer.hide();
    return;
  }

  await Promise.resolve(
    scene.debugLayer.show({
      overlay: true
    })
  );
}

export function attachDebugTools(scene: Scene): DebugToolsHandle {
  if (!import.meta.env.DEV || !environment.debugEnabled || !environment.inspectorEnabled) {
    return {
      dispose(): void {}
    };
  }

  let disposed = false;

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.altKey && event.code === "KeyI") {
      event.preventDefault();
      void toggleInspector(scene);
    }
  };

  const cleanup = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.removeEventListener("keydown", handleKeydown);

    if (scene.debugLayer.isVisible()) {
      void scene.debugLayer.hide();
    }
  };

  window.addEventListener("keydown", handleKeydown);
  scene.onDisposeObservable.add(cleanup);

  if (environment.inspectorAutoOpen) {
    void toggleInspector(scene, true);
  }

  return {
    dispose: cleanup
  };
}
