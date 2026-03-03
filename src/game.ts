import type { Engine } from "@babylonjs/core";
import type { CharacterId } from "./characterSelection";
import { createArenaScene } from "./scene";

export function startLocalGame(
  engine: Engine,
  canvas: HTMLCanvasElement,
  selectedCharacter: CharacterId
): () => void {
  const { scene } = createArenaScene(engine, canvas, selectedCharacter);

  return () => {
    scene.dispose();
  };
}
