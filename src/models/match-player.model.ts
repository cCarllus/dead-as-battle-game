// Responsável por tipar payloads e estado de jogadores sincronizados na sala global_match.
export type MatchPlayerPosition = {
  x: number;
  y: number;
  z: number;
};

export type MatchPlayerState = {
  sessionId: string;
  userId: string;
  nickname: string;
  selectedHeroId: string;
  position: MatchPlayerPosition;
  joinedAt: number;
};

export type MatchSnapshotPayload = {
  players: Record<string, MatchPlayerState>;
};

export type MatchPlayerJoinedPayload = {
  player: MatchPlayerState;
};

export type MatchPlayerLeftPayload = {
  sessionId: string;
  userId?: string;
  leftAt?: number;
};
