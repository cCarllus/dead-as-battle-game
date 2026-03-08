// Centraliza nomes de eventos de rede da partida para evitar strings espalhadas.
export const MATCH_EVENTS = {
  snapshotRequest: "match:snapshot:request",
  snapshot: "match:snapshot",
  playerJoined: "match:player:joined",
  playerLeft: "match:player:left",
  playerMoveInput: "player_move",
  playerMoved: "match:player:moved",
  sprintIntent: "player:sprint:intent",
  ultimateActivate: "ultimate:activate",
  attackStart: "attack:start",
  blockStart: "block:start",
  blockEnd: "block:end",
  playerRespawn: "player:respawn",
  combatHit: "combat:hit",
  combatBlock: "combat:block",
  combatGuardBreak: "combat:guardBreak",
  combatKill: "combat:kill",
  combatUltimate: "combat:ultimate",
  combatState: "combat:state"
} as const;

export type MatchEventName = (typeof MATCH_EVENTS)[keyof typeof MATCH_EVENTS];
