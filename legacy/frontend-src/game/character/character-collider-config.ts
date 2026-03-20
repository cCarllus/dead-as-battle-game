// Responsável por centralizar perfis de collider e helpers de alinhamento base/top para o runtime de personagem.
export type CharacterColliderProfileName =
  | "default"
  | "rolling"
  | "hanging"
  | "climbingUp"
  | "mantle";

export type CharacterColliderProfileConfig = {
  height: number;
  radius: number;
  centerY: number;
};

export type CharacterColliderConfig = {
  standing: CharacterColliderProfileConfig;
  crouch: CharacterColliderProfileConfig;
  rolling: CharacterColliderProfileConfig;
  hanging: CharacterColliderProfileConfig;
  climbingUp: CharacterColliderProfileConfig;
  mantle: CharacterColliderProfileConfig;
  collisionClearanceY: number;
};

export function createColliderProfile(
  height: number,
  radius: number,
  centerY = height * 0.5
): CharacterColliderProfileConfig {
  return {
    height,
    radius,
    centerY
  };
}

export function cloneColliderProfile(
  profile: CharacterColliderProfileConfig
): CharacterColliderProfileConfig {
  return {
    height: profile.height,
    radius: profile.radius,
    centerY: profile.centerY
  };
}

export function cloneColliderConfig(config: CharacterColliderConfig): CharacterColliderConfig {
  return {
    standing: cloneColliderProfile(config.standing),
    crouch: cloneColliderProfile(config.crouch),
    rolling: cloneColliderProfile(config.rolling),
    hanging: cloneColliderProfile(config.hanging),
    climbingUp: cloneColliderProfile(config.climbingUp),
    mantle: cloneColliderProfile(config.mantle),
    collisionClearanceY: config.collisionClearanceY
  };
}

export function resolveColliderProfileConfig(
  config: CharacterColliderConfig,
  profileName: CharacterColliderProfileName
): CharacterColliderProfileConfig {
  switch (profileName) {
    case "rolling":
      return config.rolling;
    case "hanging":
      return config.hanging;
    case "climbingUp":
      return config.climbingUp;
    case "mantle":
      return config.mantle;
    case "default":
    default:
      return config.standing;
  }
}

export function interpolateColliderProfile(
  from: CharacterColliderProfileConfig,
  to: CharacterColliderProfileConfig,
  alpha: number
): CharacterColliderProfileConfig {
  const t = Math.max(0, Math.min(1, alpha));
  return {
    height: from.height + (to.height - from.height) * t,
    radius: from.radius + (to.radius - from.radius) * t,
    centerY: from.centerY + (to.centerY - from.centerY) * t
  };
}

export function getColliderBaseY(profile: CharacterColliderProfileConfig): number {
  return profile.centerY - profile.height * 0.5;
}

export function getColliderTopY(profile: CharacterColliderProfileConfig): number {
  return profile.centerY + profile.height * 0.5;
}
