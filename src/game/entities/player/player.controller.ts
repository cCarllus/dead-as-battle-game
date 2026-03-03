import {
  KeyboardEventTypes,
  Vector3,
  type ArcRotateCamera,
  type Engine,
  type Mesh,
  type Scene
} from "@babylonjs/core";

export type PlayerController = {
  dispose: () => void;
};

export function createPlayerController(
  scene: Scene,
  engine: Engine,
  player: Mesh,
  camera?: ArcRotateCamera
): PlayerController {
  let forward = 0;
  let right = 0;

  const keyboardObserver = scene.onKeyboardObservable.add((keyboardInfo) => {
    const isDown = keyboardInfo.type === KeyboardEventTypes.KEYDOWN;
    if (keyboardInfo.type !== KeyboardEventTypes.KEYDOWN && keyboardInfo.type !== KeyboardEventTypes.KEYUP) {
      return;
    }

    switch (keyboardInfo.event.key.toLowerCase()) {
      case "w":
      case "arrowup":
        forward = isDown ? 1 : 0;
        break;
      case "s":
      case "arrowdown":
        forward = isDown ? -1 : 0;
        break;
      case "a":
      case "arrowleft":
        right = isDown ? -1 : 0;
        break;
      case "d":
      case "arrowright":
        right = isDown ? 1 : 0;
        break;
      default:
        break;
    }
  });

  const beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
    const delta = engine.getDeltaTime() / 1000;
    const speed = 6;

    const inputVector = new Vector3(right, 0, forward);
    if (inputVector.lengthSquared() > 0) {
      inputVector.normalize();
      const move = inputVector.scale(speed * delta);
      player.moveWithCollisions(move);
      player.rotation.y = Math.atan2(move.x, move.z);
    }

    if (camera) {
      camera.target.copyFrom(player.position.add(new Vector3(0, 1, 0)));
    }
  });

  return {
    dispose: () => {
      if (keyboardObserver) {
        scene.onKeyboardObservable.remove(keyboardObserver);
      }

      if (beforeRenderObserver) {
        scene.onBeforeRenderObservable.remove(beforeRenderObserver);
      }
    }
  };
}
