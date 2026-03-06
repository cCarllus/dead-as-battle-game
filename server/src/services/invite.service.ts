import { randomUUID } from "node:crypto";
import type { TeamInvite, TeamInviteStatus } from "../models/team-invite.model.js";

export const TEAM_INVITE_EXPIRATION_MS = 30_000;
export const TEAM_INVITE_COOLDOWN_MS = 2_000;

type TeamInviteCreateInput = {
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  toNickname: string;
  teamId: string;
};

function normalizeId(value: string): string {
  return value.trim();
}

function cloneInvite(invite: TeamInvite): TeamInvite {
  return {
    id: invite.id,
    fromUserId: invite.fromUserId,
    fromNickname: invite.fromNickname,
    toUserId: invite.toUserId,
    toNickname: invite.toNickname,
    teamId: invite.teamId,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    status: invite.status
  };
}

function createInvitePairKey(userA: string, userB: string): string {
  const normalizedA = normalizeId(userA);
  const normalizedB = normalizeId(userB);
  return [normalizedA, normalizedB].sort((left, right) => left.localeCompare(right)).join("::");
}

export class InviteService {
  private readonly inviteById = new Map<string, TeamInvite>();
  private readonly pendingInviteIdByPair = new Map<string, string>();
  private readonly lastInviteAtByUserId = new Map<string, number>();

  isCooldownActive(fromUserId: string, nowMs: number = Date.now()): boolean {
    const normalizedUserId = normalizeId(fromUserId);
    if (!normalizedUserId) {
      return true;
    }

    const lastInviteAt = this.lastInviteAtByUserId.get(normalizedUserId);
    return lastInviteAt !== undefined && nowMs - lastInviteAt < TEAM_INVITE_COOLDOWN_MS;
  }

  hasPendingInviteBetween(userA: string, userB: string, nowMs: number = Date.now()): boolean {
    this.expirePendingInvites(nowMs);
    return this.pendingInviteIdByPair.has(createInvitePairKey(userA, userB));
  }

  createInvite(input: TeamInviteCreateInput, nowMs: number = Date.now()): TeamInvite {
    const fromUserId = normalizeId(input.fromUserId);
    const toUserId = normalizeId(input.toUserId);
    const pairKey = createInvitePairKey(fromUserId, toUserId);

    const invite: TeamInvite = {
      id: randomUUID(),
      fromUserId,
      fromNickname: input.fromNickname.trim(),
      toUserId,
      toNickname: input.toNickname.trim(),
      teamId: normalizeId(input.teamId),
      createdAt: nowMs,
      expiresAt: nowMs + TEAM_INVITE_EXPIRATION_MS,
      status: "pending"
    };

    this.inviteById.set(invite.id, invite);
    this.pendingInviteIdByPair.set(pairKey, invite.id);
    this.lastInviteAtByUserId.set(fromUserId, nowMs);
    return cloneInvite(invite);
  }

  getInviteById(inviteId: string): TeamInvite | null {
    const invite = this.inviteById.get(normalizeId(inviteId));
    return invite ? cloneInvite(invite) : null;
  }

  markAccepted(inviteId: string): TeamInvite | null {
    return this.updateInviteStatus(inviteId, "accepted");
  }

  markDeclined(inviteId: string): TeamInvite | null {
    return this.updateInviteStatus(inviteId, "declined");
  }

  markExpired(inviteId: string): TeamInvite | null {
    return this.updateInviteStatus(inviteId, "expired");
  }

  expirePendingInvites(nowMs: number = Date.now()): TeamInvite[] {
    const expiredInvites: TeamInvite[] = [];

    this.inviteById.forEach((invite) => {
      if (invite.status !== "pending") {
        return;
      }

      if (invite.expiresAt > nowMs) {
        return;
      }

      invite.status = "expired";
      this.pendingInviteIdByPair.delete(createInvitePairKey(invite.fromUserId, invite.toUserId));
      expiredInvites.push(cloneInvite(invite));
    });

    return expiredInvites;
  }

  expirePendingInvitesForUser(userId: string, status: TeamInviteStatus = "expired"): TeamInvite[] {
    const normalizedUserId = normalizeId(userId);
    if (!normalizedUserId) {
      return [];
    }

    const updatedInvites: TeamInvite[] = [];

    this.inviteById.forEach((invite) => {
      if (invite.status !== "pending") {
        return;
      }

      if (invite.fromUserId !== normalizedUserId && invite.toUserId !== normalizedUserId) {
        return;
      }

      invite.status = status;
      this.pendingInviteIdByPair.delete(createInvitePairKey(invite.fromUserId, invite.toUserId));
      updatedInvites.push(cloneInvite(invite));
    });

    return updatedInvites;
  }

  expirePendingInvitesForTeam(teamId: string, status: TeamInviteStatus = "expired"): TeamInvite[] {
    const normalizedTeamId = normalizeId(teamId);
    if (!normalizedTeamId) {
      return [];
    }

    const updatedInvites: TeamInvite[] = [];

    this.inviteById.forEach((invite) => {
      if (invite.status !== "pending") {
        return;
      }

      if (invite.teamId !== normalizedTeamId) {
        return;
      }

      invite.status = status;
      this.pendingInviteIdByPair.delete(createInvitePairKey(invite.fromUserId, invite.toUserId));
      updatedInvites.push(cloneInvite(invite));
    });

    return updatedInvites;
  }

  getPendingInvitesForUser(userId: string, nowMs: number = Date.now()): TeamInvite[] {
    const normalizedUserId = normalizeId(userId);
    if (!normalizedUserId) {
      return [];
    }

    this.expirePendingInvites(nowMs);

    const pendingInvites: TeamInvite[] = [];

    this.inviteById.forEach((invite) => {
      if (invite.status !== "pending") {
        return;
      }

      if (invite.toUserId !== normalizedUserId) {
        return;
      }

      pendingInvites.push(cloneInvite(invite));
    });

    pendingInvites.sort((left, right) => left.createdAt - right.createdAt);
    return pendingInvites;
  }

  private updateInviteStatus(inviteId: string, nextStatus: Exclude<TeamInviteStatus, "pending">): TeamInvite | null {
    const invite = this.inviteById.get(normalizeId(inviteId));
    if (!invite || invite.status !== "pending") {
      return null;
    }

    invite.status = nextStatus;
    this.pendingInviteIdByPair.delete(createInvitePairKey(invite.fromUserId, invite.toUserId));
    return cloneInvite(invite);
  }
}
