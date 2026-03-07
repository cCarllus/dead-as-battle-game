// Responsável por tipar payloads e estado de jogadores sincronizados na sala global_match.
export type MatchPlayerState = {
  sessionId: string;
  userId: string;
  nickname: string;
  heroId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  kills: number;
  deaths: number;
  maxHealth: number;
  currentHealth: number;
  isAlive: boolean;
  ultimateCharge: number;
  ultimateMax: number;
  isUltimateReady: boolean;
  maxStamina: number;
  currentStamina: number;
  isSprinting: boolean;
  sprintBlocked: boolean;
  lastSprintEndedAt: number;
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

export type MatchPlayerMovedPayload = {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
};
