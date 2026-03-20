import { Engine } from "@babylonjs/core/Engines/engine";

import type { AppEnvironment } from "@/config/env";

export function createEngine(
  canvas: HTMLCanvasElement,
  environment: AppEnvironment
): Engine {
  return new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: environment.inspectorEnabled,
      powerPreference: "high-performance",
      stencil: true
    },
    true
  );
}
