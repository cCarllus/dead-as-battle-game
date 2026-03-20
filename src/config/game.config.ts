import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

export const GAME_CONFIG = Object.freeze({
  appName: "Dead As Battleground",
  canvasId: "game-canvas",
  clearColor: new Color4(0.04, 0.06, 0.1, 1),
  ambientColor: new Color3(0.35, 0.38, 0.42),
  camera: Object.freeze({
    alpha: -Math.PI / 2,
    beta: 1.15,
    radius: 12,
    lowerBetaLimit: 0.45,
    upperBetaLimit: 1.35,
    lowerRadiusLimit: 4,
    upperRadiusLimit: 22,
    wheelDeltaPercentage: 0.01
  })
});
