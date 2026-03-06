import type { TeamMember } from "./team-member.model.js";

export type Team = {
  id: string;
  leaderUserId: string;
  members: TeamMember[];
  createdAt: number;
};
