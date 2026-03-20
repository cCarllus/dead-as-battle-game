import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import { createThirdPersonCamera } from "@/camera/create-third-person-camera";
import { attachDebugTools } from "@/debug/debug-tools";
import { GAME_CONFIG } from "@/config/game.config";
import type { GameSceneDefinition } from "@/core/scene/scene-contract";
import type { GameRuntime } from "@/core/runtime/game-runtime";
import { GAME_STATE } from "@/game/states/game-state";
import { createSceneHud } from "@/ui/create-hud";
import { createTestEnvironment } from "@/environment/create-test-environment";

function createSandboxScene(runtime: GameRuntime): Scene {
  const scene = new Scene(runtime.engine);
  scene.clearColor = GAME_CONFIG.clearColor;
  scene.ambientColor = GAME_CONFIG.ambientColor;
  scene.collisionsEnabled = true;
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = Color3.FromHexString("#09121d");

  const skylight = new HemisphericLight(
    "skylight",
    new Vector3(0.15, 1, 0.2),
    scene
  );
  skylight.intensity = 0.8;
  skylight.groundColor = Color3.FromHexString("#17202d");

  const sun = new DirectionalLight("sun", new Vector3(-0.35, -1, 0.2), scene);
  sun.position = new Vector3(16, 24, -10);
  sun.intensity = 2.4;

  const shadowGenerator = new ShadowGenerator(2048, sun);
  shadowGenerator.usePercentageCloserFiltering = true;

  const environment = createTestEnvironment(scene);
  shadowGenerator.addShadowCaster(environment.playerProxy);

  createThirdPersonCamera({
    scene,
    canvas: runtime.canvas,
    target: environment.cameraTarget
  });

  const hud = createSceneHud(scene, {
    runtime,
    sceneLabel: GAME_STATE.sandbox
  });
  const debugTools = attachDebugTools(scene);

  scene.onDisposeObservable.add(() => {
    debugTools.dispose();
    hud.dispose();
  });

  return scene;
}

export function createSandboxSceneDefinition(): GameSceneDefinition {
  return {
    id: GAME_STATE.sandbox,
    create: createSandboxScene
  };
}
