export type TeamMember = {
  userId: string;
  nickname: string;
  joinedAt: number;
};

export type Team = {
  id: string;
  leaderUserId: string;
  members: TeamMember[];
  createdAt: number;
};
