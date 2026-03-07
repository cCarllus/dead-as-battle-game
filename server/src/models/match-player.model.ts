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
