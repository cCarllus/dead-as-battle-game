import { randomUUID } from "node:crypto";
import type { TeamMember } from "../models/team-member.model.js";
import type { Team } from "../models/team.model.js";

export const TEAM_MAX_MEMBERS = 3;

type TeamCreateLeader = {
  userId: string;
  nickname: string;
};

export type TeamMemberLeaveResult = {
  teamId: string;
  team: Team | null;
  removedMember: TeamMember;
  wasLeader: boolean;
  newLeaderUserId: string | null;
};

function cloneMember(member: TeamMember): TeamMember {
  return {
    userId: member.userId,
    nickname: member.nickname,
    joinedAt: member.joinedAt
  };
}

function cloneTeam(team: Team): Team {
  return {
    id: team.id,
    leaderUserId: team.leaderUserId,
    createdAt: team.createdAt,
    members: team.members.map(cloneMember)
  };
}

export class TeamService {
  private readonly teamById = new Map<string, Team>();
  private readonly teamIdByUserId = new Map<string, string>();

  createTeam(leader: TeamCreateLeader, nowMs: number = Date.now()): Team {
    const normalizedLeaderId = leader.userId.trim();
    const normalizedNickname = leader.nickname.trim();

    const team: Team = {
      id: randomUUID(),
      leaderUserId: normalizedLeaderId,
      members: [
        {
          userId: normalizedLeaderId,
          nickname: normalizedNickname,
          joinedAt: nowMs
        }
      ],
      createdAt: nowMs
    };

    this.teamById.set(team.id, team);
    this.teamIdByUserId.set(normalizedLeaderId, team.id);
    return cloneTeam(team);
  }

  ensureTeamForLeader(leader: TeamCreateLeader, nowMs: number = Date.now()): Team {
    const existingTeam = this.getTeamByUserId(leader.userId);
    if (existingTeam) {
      return existingTeam;
    }

    return this.createTeam(leader, nowMs);
  }

  getTeamById(teamId: string): Team | null {
    const team = this.teamById.get(teamId.trim());
    return team ? cloneTeam(team) : null;
  }

  getTeamByUserId(userId: string): Team | null {
    const teamId = this.teamIdByUserId.get(userId.trim());
    if (!teamId) {
      return null;
    }

    const team = this.teamById.get(teamId);
    return team ? cloneTeam(team) : null;
  }

  hasUserInTeam(userId: string): boolean {
    return this.teamIdByUserId.has(userId.trim());
  }

  addMember(teamId: string, member: TeamCreateLeader, nowMs: number = Date.now()): Team | null {
    const normalizedTeamId = teamId.trim();
    const normalizedUserId = member.userId.trim();
    const normalizedNickname = member.nickname.trim();

    if (!normalizedTeamId || !normalizedUserId || !normalizedNickname) {
      return null;
    }

    const team = this.teamById.get(normalizedTeamId);
    if (!team) {
      return null;
    }

    if (team.members.some((entry) => entry.userId === normalizedUserId)) {
      return cloneTeam(team);
    }

    if (team.members.length >= TEAM_MAX_MEMBERS) {
      return null;
    }

    team.members.push({
      userId: normalizedUserId,
      nickname: normalizedNickname,
      joinedAt: nowMs
    });

    this.teamIdByUserId.set(normalizedUserId, normalizedTeamId);
    return cloneTeam(team);
  }

  removeMember(userId: string): TeamMemberLeaveResult | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }

    const teamId = this.teamIdByUserId.get(normalizedUserId);
    if (!teamId) {
      return null;
    }

    const team = this.teamById.get(teamId);
    if (!team) {
      this.teamIdByUserId.delete(normalizedUserId);
      return null;
    }

    const memberIndex = team.members.findIndex((member) => member.userId === normalizedUserId);
    if (memberIndex < 0) {
      this.teamIdByUserId.delete(normalizedUserId);
      return null;
    }

    const removedMember = team.members[memberIndex];
    team.members.splice(memberIndex, 1);
    this.teamIdByUserId.delete(normalizedUserId);

    const wasLeader = team.leaderUserId === normalizedUserId;
    let newLeaderUserId: string | null = null;

    if (team.members.length === 0) {
      this.teamById.delete(team.id);
      return {
        teamId,
        team: null,
        removedMember: cloneMember(removedMember),
        wasLeader,
        newLeaderUserId
      };
    }

    if (wasLeader) {
      team.leaderUserId = team.members[0].userId;
      newLeaderUserId = team.leaderUserId;
    }

    return {
      teamId,
      team: cloneTeam(team),
      removedMember: cloneMember(removedMember),
      wasLeader,
      newLeaderUserId
    };
  }
}
