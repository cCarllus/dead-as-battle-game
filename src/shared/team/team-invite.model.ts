export type TeamInviteStatus = "pending" | "accepted" | "declined" | "expired";

export type TeamInvite = {
  id: string;
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  toNickname: string;
  teamId: string;
  createdAt: number;
  expiresAt: number;
  status: TeamInviteStatus;
};
