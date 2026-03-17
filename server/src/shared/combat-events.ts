// Responsável por padronizar nomes de eventos de combate replicados pela sala autoritativa.
export const COMBAT_EVENT_NAMES = {
  attackStarted: "combat:attack_started",
  hitConfirmed: "combat:hit_confirmed",
  damageApplied: "combat:damage_applied",
  skillCastStarted: "combat:skill_cast_started",
  skillCastFinished: "combat:skill_cast_finished",
  playerDied: "combat:player_died",
  killConfirmed: "combat:kill_confirmed",
  ragdollEnabled: "combat:ragdoll_enabled",
  stateChanged: "combat:state"
} as const;

export type CombatEventName = (typeof COMBAT_EVENT_NAMES)[keyof typeof COMBAT_EVENT_NAMES];
