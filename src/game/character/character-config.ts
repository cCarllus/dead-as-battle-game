// Responsável por centralizar tuning estrutural do runtime padrão de personagem jogável.
import {
  cloneColliderConfig,
  createColliderProfile,
  type CharacterColliderConfig
} from "./character-collider-config";

export type CharacterLocomotionConfig = {
  walkSpeed: number;
  runSpeed: number;
  crouchSpeed: number;
  rollingInitialSpeed: number;
  rollingMinSpeed: number;
  rollingDurationMs: number;
  rollingCooldownMs: number;
  wallRunSpeed: number;
  wallRunDurationMs: number;
  wallRunGravityMultiplier: number;
  wallRunMinEntryFallSpeed: number;
  acceleration: number;
  deceleration: number;
  airAcceleration: number;
  airDeceleration: number;
  airControl: number;
  normalJumpForwardBoost: number;
  runJumpForwardBoost: number;
  groundStickForce: number;
  turnSpeedRadians: number;
  jumpVelocity: number;
  doubleJumpVelocity: number;
  gravity: number;
  fallGravityMultiplier: number;
  maxFallSpeed: number;
  jumpBufferTimeMs: number;
  coyoteTimeMs: number;
  groundedSnapDistance: number;
  groundedStickDistance: number;
  groundedRayLength: number;
  wallDetectionDistance: number;
  slopeLimitDegrees: number;
  sprintBurstDurationMs: number;
  sprintBurstSpeedMultiplier: number;
  crouchCameraOffsetY: number;
  rollingCameraOffsetY: number;
  sprintFovBoostRadians: number;
  wallRunFovBoostRadians: number;
  wallRunTiltRadians: number;
};

export type CharacterLedgeConfig = {
  minClimbHeight: number;
  maxClimbHeight: number;
  maxMantleSlopeAngleDegrees: number;
  hangDetectionDistance: number;
  wallDetectionDistance: number;
  chestProbeHeight: number;
  headProbeHeight: number;
  topProbeHeightPadding: number;
  mantleForwardOffset: number;
  topClearanceHeight: number;
  hangForwardOffset: number;
  hangVerticalOffset: number;
  hangLateralOffset: number;
  hangRotationOffsetRadians: number;
  topStandOffset: number;
  climbDurationMs: number;
  mantleDurationMs: number;
  regrabCooldownMs: number;
  dropFromLedgeEnabled: boolean;
  dropReleaseVelocity: number;
};

export type CharacterRuntimeConfig = {
  collider: CharacterColliderConfig;
  anchors: {
    cameraTargetOffsetY: number;
    nameplateOffsetY: number;
    groundCheckOffsetY: number;
    wallCheckOffsetY: number;
    wallCheckHorizontalOffset: number;
    audioRootOffsetY: number;
  };
  locomotion: CharacterLocomotionConfig;
  ledge: CharacterLedgeConfig;
};

export const DEFAULT_CHARACTER_RUNTIME_CONFIG: Readonly<CharacterRuntimeConfig> = {
  collider: {
    standing: createColliderProfile(2.18, 0.41, 1.09),
    crouch: createColliderProfile(1.62, 0.41, 0.81),
    rolling: createColliderProfile(1.38, 0.41, 0.69),
    hanging: createColliderProfile(1.28, 0.41, 0.64),
    climbingUp: createColliderProfile(1.84, 0.41, 0.93),
    mantle: createColliderProfile(2.02, 0.41, 1.02),
    collisionClearanceY: 0.03
  },
  anchors: {
    cameraTargetOffsetY: 1.24,
    nameplateOffsetY: 2.82,
    groundCheckOffsetY: 0.08,
    wallCheckOffsetY: 1.14,
    wallCheckHorizontalOffset: 0.56,
    audioRootOffsetY: 1.0
  },
  locomotion: {
    walkSpeed: 4.8,
    runSpeed: 8.9,
    crouchSpeed: 2.45,
    rollingInitialSpeed: 10.8,
    rollingMinSpeed: 3.8,
    rollingDurationMs: 620,
    rollingCooldownMs: 280,
    wallRunSpeed: 7.4,
    wallRunDurationMs: 860,
    wallRunGravityMultiplier: 0.24,
    wallRunMinEntryFallSpeed: -1.4,
    acceleration: 30,
    deceleration: 34,
    airAcceleration: 14,
    airDeceleration: 12,
    airControl: 0.3,
    normalJumpForwardBoost: 0.45,
    runJumpForwardBoost: 1.05,
    groundStickForce: 22,
    turnSpeedRadians: 18,
    jumpVelocity: 8.2,
    doubleJumpVelocity: 7.6,
    gravity: 25,
    fallGravityMultiplier: 1.18,
    maxFallSpeed: 32,
    jumpBufferTimeMs: 120,
    coyoteTimeMs: 120,
    groundedSnapDistance: 0.12,
    groundedStickDistance: 0.22,
    groundedRayLength: 1.95,
    wallDetectionDistance: 0.72,
    slopeLimitDegrees: 48,
    sprintBurstDurationMs: 180,
    sprintBurstSpeedMultiplier: 1.12,
    crouchCameraOffsetY: -0.26,
    rollingCameraOffsetY: -0.38,
    sprintFovBoostRadians: (10 * Math.PI) / 180,
    wallRunFovBoostRadians: (6 * Math.PI) / 180,
    wallRunTiltRadians: (8 * Math.PI) / 180
  },
  ledge: {
    minClimbHeight: 0.42,
    maxClimbHeight: 2.9,
    maxMantleSlopeAngleDegrees: 40,
    hangDetectionDistance: 0.92,
    wallDetectionDistance: 1.02,
    chestProbeHeight: 1.08,
    headProbeHeight: 1.72,
    topProbeHeightPadding: 0.78,
    mantleForwardOffset: 0.3,
    topClearanceHeight: 2.1,
    hangForwardOffset: 0.05,
    hangVerticalOffset: 2.08,
    hangLateralOffset: 0,
    hangRotationOffsetRadians: 0,
    topStandOffset: 0.28,
    climbDurationMs: 780,
    mantleDurationMs: 520,
    regrabCooldownMs: 280,
    dropFromLedgeEnabled: true,
    dropReleaseVelocity: -4.2
  }
};

export function cloneCharacterRuntimeConfig(config: CharacterRuntimeConfig): CharacterRuntimeConfig {
  return {
    collider: cloneColliderConfig(config.collider),
    anchors: {
      cameraTargetOffsetY: config.anchors.cameraTargetOffsetY,
      nameplateOffsetY: config.anchors.nameplateOffsetY,
      groundCheckOffsetY: config.anchors.groundCheckOffsetY,
      wallCheckOffsetY: config.anchors.wallCheckOffsetY,
      wallCheckHorizontalOffset: config.anchors.wallCheckHorizontalOffset,
      audioRootOffsetY: config.anchors.audioRootOffsetY
    },
    locomotion: { ...config.locomotion },
    ledge: { ...config.ledge }
  };
}
