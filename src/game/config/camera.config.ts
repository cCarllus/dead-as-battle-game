// Responsável por centralizar tuning da câmera third-person para evitar números mágicos espalhados.
export type CameraControllerConfig = {
  radius: number;
  mouseSensitivity: number;
  minBeta: number;
  maxBeta: number;
  targetVerticalOffset: number;
  targetLateralOffset: number;
  targetSmoothTimeSeconds: number;
  fovSmoothTimeSeconds: number;
  screenOffsetSmoothTimeSeconds: number;
  baseFovRadians: number;
  sprintBurstFovKickRadians: number;
  landingDropBase: number;
  landingDropScale: number;
  landingRecoverySpeed: number;
  sprintCameraVibration: number;
};

export const DEFAULT_CAMERA_CONTROLLER_CONFIG: Readonly<CameraControllerConfig> = {
  radius: 6.9,
  mouseSensitivity: 0.0022,
  minBeta: 0.08,
  maxBeta: Math.PI - 0.08,
  targetVerticalOffset: 1.72,
  targetLateralOffset: 0.92,
  targetSmoothTimeSeconds: 0.095,
  fovSmoothTimeSeconds: 0.11,
  screenOffsetSmoothTimeSeconds: 0.12,
  baseFovRadians: (70 * Math.PI) / 180,
  sprintBurstFovKickRadians: (2.4 * Math.PI) / 180,
  landingDropBase: 0.025,
  landingDropScale: 0.06,
  landingRecoverySpeed: 7,
  sprintCameraVibration: 0.00085
};
