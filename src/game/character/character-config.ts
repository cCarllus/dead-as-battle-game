// Responsável por centralizar tuning estrutural do runtime padrão de personagem jogável.
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

export type CharacterRuntimeConfig = {
  colliderHeight: number;
  colliderRadius: number;
  crouchColliderHeight: number;
  rollingColliderHeight: number;
  collisionClearanceY: number;
  cameraTargetOffsetY: number;
  nameplateOffsetY: number;
  groundCheckOffsetY: number;
  wallCheckOffsetY: number;
  wallCheckHorizontalOffset: number;
  audioRootOffsetY: number;
  locomotion: CharacterLocomotionConfig;
};

export const DEFAULT_CHARACTER_RUNTIME_CONFIG: Readonly<CharacterRuntimeConfig> = {
  colliderHeight: 2.4,
  colliderRadius: 0.44,
  crouchColliderHeight: 1.72,
  rollingColliderHeight: 1.42,
  collisionClearanceY: 0.02,
  cameraTargetOffsetY: 1.28,
  nameplateOffsetY: 2.92,
  groundCheckOffsetY: 0.08,
  wallCheckOffsetY: 1.18,
  wallCheckHorizontalOffset: 0.58,
  audioRootOffsetY: 1.02,
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
  }
};
