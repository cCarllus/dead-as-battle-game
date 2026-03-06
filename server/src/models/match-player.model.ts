// Responsável por tipar o estado de presença dos jogadores dentro da sala de partida global.
export type MatchPosition = {
  x: number;
  y: number;
  z: number;
};

export type MatchPlayerState = {
  sessionId: string;
  userId: string;
  nickname: string;
  selectedHeroId: string;
  position: MatchPosition;
  joinedAt: number;
};

export type GlobalMatchState = {
  players: Record<string, MatchPlayerState>;
};

export type MatchJoinOptions = {
  userId?: unknown;
  nickname?: unknown;
  selectedHeroId?: unknown;
};
