// Responsável por tipar o estado de presença dos jogadores dentro da sala de partida global.
export type MatchPlayerState = {
  sessionId: string;
  userId: string;
  nickname: string;
  heroId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  maxHealth: number;
  currentHealth: number;
  isAlive: boolean;
  ultimateCharge: number;
  ultimateMax: number;
  isUltimateReady: boolean;
  joinedAt: number;
};

export type GlobalMatchState = {
  players: Record<string, MatchPlayerState>;
};

export type MatchJoinOptions = {
  userId?: unknown;
  nickname?: unknown;
  heroId?: unknown;
};

export type MatchMovePayload = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
  rotationY?: unknown;
};

export type MatchUltimateActivatePayload = Record<string, never>;
