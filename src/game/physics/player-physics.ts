// Responsável por centralizar constantes e tipos de tuning de física/game feel do jogador local.
export type PlayerPhysicsConfig = {
  walkSpeed: number;
  runSpeed: number;
  acceleration: number;
  deceleration: number;
  airAcceleration: number;
  airDeceleration: number;
  turnSpeedRadians: number;
  jumpVelocity: number;
  gravity: number;
  fallGravityMultiplier: number;
  maxFallSpeed: number;
  jumpBufferTimeMs: number;
  coyoteTimeMs: number;
  groundedSnapDistance: number;
  groundedStickDistance: number;
  groundedRayLength: number;
};

export const DEFAULT_PLAYER_PHYSICS_CONFIG: PlayerPhysicsConfig = {
  walkSpeed: 4.8,
  runSpeed: 8.9,
  acceleration: 30,
  deceleration: 34,
  airAcceleration: 14,
  airDeceleration: 12,
  turnSpeedRadians: 18,
  jumpVelocity: 8.2,
  gravity: 25,
  fallGravityMultiplier: 1.18,
  maxFallSpeed: 32,
  jumpBufferTimeMs: 120,
  coyoteTimeMs: 120,
  groundedSnapDistance: 0.12,
  groundedStickDistance: 0.22,
  groundedRayLength: 1.9
};

export const MAX_FRAME_DELTA_SECONDS = 0.05;
