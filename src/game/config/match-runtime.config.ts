// Responsável por concentrar tuning da cena de partida, sincronização local e predição de combate.
export const GLOBAL_MATCH_RUNTIME_CONFIG = {
  movementSync: {
    intervalMs: 50,
    thresholdMeters: 0.015,
    rotationThresholdRadians: 0.01,
    verticalVelocityThreshold: 0.15
  },
  sprintIntentSync: {
    intervalMs: 50
  },
  combatPrediction: {
    attackIntervalMs: 300,
    comboResetMs: 1000,
    attackAnimationWindowMs: 260,
    attackInputBufferMs: 120,
    blockMaxHoldMs: 2500
  },
  localVisualCulling: {
    cameraHideRadiusMultiplier: 1.05
  }
} as const;
