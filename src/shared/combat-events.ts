// Responsável por nomear eventos lógicos de combate consumidos por HUD, VFX, áudio e feedback local.
export const COMBAT_EVENTS = {
  attackStarted: "attack_started",
  hitConfirmed: "hit_confirmed",
  damageApplied: "damage_applied",
  skillCastStarted: "skill_cast_started",
  skillCastFinished: "skill_cast_finished",
  playerDied: "player_died",
  killConfirmed: "kill_confirmed",
  ragdollEnabled: "ragdoll_enabled"
} as const;

export type CombatEventName = (typeof COMBAT_EVENTS)[keyof typeof COMBAT_EVENTS];
