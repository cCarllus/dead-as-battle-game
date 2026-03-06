import { randomUUID } from "node:crypto";
import { Room, Client } from "@colyseus/core";
import type { ChatMessage } from "../models/chat-message.model.js";
import type { TeamInvite } from "../models/team-invite.model.js";
import type { Team } from "../models/team.model.js";
import { ChatHistoryService } from "../services/chat-history.service.js";
import { AntiSpamService } from "../services/anti-spam.service.js";
import { InviteService } from "../services/invite.service.js";
import { TeamService, TEAM_MAX_MEMBERS } from "../services/team.service.js";

type ChatSendPayload = {
  userId?: unknown;
  nickname?: unknown;
  championName?: unknown;
  championLevel?: unknown;
  text?: unknown;
};

type TeamInvitePayload = {
  fromUserId?: unknown;
  toUserId?: unknown;
};

type TeamInviteActionPayload = {
  inviteId?: unknown;
};

type TeamKickPayload = {
  targetUserId?: unknown;
};

type TeamLeavePayload = {
  userId?: unknown;
};

type JoinOptions = {
  userId?: unknown;
  nickname?: unknown;
  championName?: unknown;
  championLevel?: unknown;
};

type ChatParticipant = {
  sessionId: string;
  userId: string;
  nickname: string;
  championName: string;
  championLevel: number;
};

type ChatErrorCode = "EMPTY" | "TOO_LONG" | "COOLDOWN";

type TeamErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_INVITER"
  | "INVALID_TARGET"
  | "INVALID_INVITE"
  | "INVALID_LEAVER"
  | "TARGET_OFFLINE"
  | "SELF_INVITE"
  | "TEAM_FULL"
  | "TARGET_ALREADY_IN_TEAM"
  | "INVITE_ALREADY_PENDING"
  | "INVITE_COOLDOWN"
  | "INVITE_NOT_FOUND"
  | "INVITE_NOT_PENDING"
  | "INVITE_EXPIRED"
  | "NOT_INVITED_USER"
  | "TEAM_NOT_FOUND"
  | "TEAM_JOIN_FAILED"
  | "TEAM_REQUIRED"
  | "LEADER_REQUIRED"
  | "TARGET_NOT_IN_TEAM"
  | "LEADER_CANNOT_KICK_SELF";

const CHAT_SEND_EVENT = "chat:send";
const CHAT_MESSAGE_EVENT = "chat:message";
const CHAT_HISTORY_EVENT = "chat:history";
const CHAT_ERROR_EVENT = "chat:error";
const CHAT_PRESENCE_EVENT = "chat:presence";

const TEAM_INVITE_EVENT = "team:invite";
const TEAM_ACCEPT_EVENT = "team:accept";
const TEAM_DECLINE_EVENT = "team:decline";
const TEAM_KICK_EVENT = "team:kick";
const TEAM_LEAVE_EVENT = "team:leave";

const TEAM_INVITE_SENT_EVENT = "team:invite:sent";
const TEAM_INVITE_RECEIVED_EVENT = "team:invite:received";
const TEAM_INVITE_DECLINED_EVENT = "team:invite:declined";
const TEAM_UPDATED_EVENT = "team:updated";
const TEAM_LEFT_EVENT = "team:left";
const TEAM_KICKED_EVENT = "team:kicked";
const TEAM_ERROR_EVENT = "team:error";

const MAX_HISTORY_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 200;
const MAX_NICKNAME_LENGTH = 24;
const MAX_CHAMPION_NAME_LENGTH = 28;
const CHAT_COOLDOWN_MS = 1000;
const TEAM_RECONNECT_GRACE_MS = 20_000;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeInviteId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNickname(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_NICKNAME_LENGTH);
}

function normalizeChampionName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_CHAMPION_NAME_LENGTH);
}

function normalizeChampionLevel(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized >= 1 ? normalized : null;
}

function createMessageId(): string {
  return randomUUID();
}

export class GlobalChatRoom extends Room {
  private readonly history = new ChatHistoryService(MAX_HISTORY_MESSAGES);
  private readonly antiSpam = new AntiSpamService(CHAT_COOLDOWN_MS);
  private readonly teamService = new TeamService();
  private readonly inviteService = new InviteService();
  private readonly participantBySessionId = new Map<string, ChatParticipant>();
  private readonly clientBySessionId = new Map<string, Client>();
  private readonly sessionIdsByUserId = new Map<string, Set<string>>();
  private readonly pendingOfflineCleanupByUserId = new Map<string, ReturnType<typeof setTimeout>>();

  onCreate(): void {
    // Mantem a sala viva mesmo sem clientes para preservar historico em memoria.
    this.autoDispose = false;

    this.onMessage(CHAT_SEND_EVENT, (client, payload: ChatSendPayload) => {
      this.handleChatSend(client, payload);
    });

    this.onMessage(TEAM_INVITE_EVENT, (client, payload: TeamInvitePayload) => {
      this.handleTeamInvite(client, payload);
    });

    this.onMessage(TEAM_ACCEPT_EVENT, (client, payload: TeamInviteActionPayload) => {
      this.handleTeamAccept(client, payload);
    });

    this.onMessage(TEAM_DECLINE_EVENT, (client, payload: TeamInviteActionPayload) => {
      this.handleTeamDecline(client, payload);
    });

    this.onMessage(TEAM_KICK_EVENT, (client, payload: TeamKickPayload) => {
      this.handleTeamKick(client, payload);
    });

    this.onMessage(TEAM_LEAVE_EVENT, (client, payload: TeamLeavePayload) => {
      this.handleTeamLeave(client, payload);
    });

    this.clock.setInterval(() => {
      this.inviteService.expirePendingInvites(Date.now());
    }, 1000);
  }

  onJoin(client: Client, options?: JoinOptions): void {
    const userId = normalizeUserId(options?.userId) ?? client.sessionId;
    const nickname = normalizeNickname(options?.nickname) ?? "Player";
    const championName = normalizeChampionName(options?.championName) ?? "Unknown";
    const championLevel = normalizeChampionLevel(options?.championLevel) ?? 1;

    this.participantBySessionId.set(client.sessionId, {
      sessionId: client.sessionId,
      userId,
      nickname,
      championName,
      championLevel
    });

    this.clientBySessionId.set(client.sessionId, client);

    const sessionIds = this.sessionIdsByUserId.get(userId) ?? new Set<string>();
    sessionIds.add(client.sessionId);
    this.sessionIdsByUserId.set(userId, sessionIds);
    this.clearPendingOfflineCleanup(userId);

    client.send(CHAT_HISTORY_EVENT, this.history.getHistory());
    this.broadcastChatPresence();

    const existingTeam = this.teamService.getTeamByUserId(userId);
    if (existingTeam) {
      client.send(TEAM_UPDATED_EVENT, { team: existingTeam });
    }

    this.inviteService.getPendingInvitesForUser(userId, Date.now()).forEach((invite) => {
      client.send(TEAM_INVITE_RECEIVED_EVENT, this.toInviteReceivedPayload(invite));
    });
  }

  onLeave(client: Client): void {
    const participant = this.participantBySessionId.get(client.sessionId);

    this.participantBySessionId.delete(client.sessionId);
    this.clientBySessionId.delete(client.sessionId);

    if (!participant) {
      return;
    }

    const sessionIds = this.sessionIdsByUserId.get(participant.userId);
    if (sessionIds) {
      sessionIds.delete(client.sessionId);
      if (sessionIds.size === 0) {
        this.sessionIdsByUserId.delete(participant.userId);
      }
    }

    this.broadcastChatPresence();

    if (this.isUserOnline(participant.userId)) {
      return;
    }

    this.scheduleOfflineCleanup(participant.userId);
  }

  private handleChatSend(client: Client, payload: ChatSendPayload): void {
    const text = normalizeText(payload?.text);
    if (!text) {
      this.sendChatError(client, "EMPTY", "Empty messages are not allowed.");
      return;
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      this.sendChatError(client, "TOO_LONG", `Message limit is ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    const fallbackAuthor = this.participantBySessionId.get(client.sessionId);
    const userId =
      fallbackAuthor?.userId ??
      normalizeUserId(payload?.userId) ??
      client.sessionId;

    if (!this.antiSpam.canSend(userId)) {
      this.sendChatError(client, "COOLDOWN", "Please wait before sending another message.");
      return;
    }

    const nickname =
      fallbackAuthor?.nickname ??
      normalizeNickname(payload?.nickname) ??
      "Player";
    const championName =
      normalizeChampionName(payload?.championName) ??
      fallbackAuthor?.championName ??
      "Unknown";
    const championLevel =
      normalizeChampionLevel(payload?.championLevel) ??
      fallbackAuthor?.championLevel ??
      1;

    this.participantBySessionId.set(client.sessionId, {
      sessionId: client.sessionId,
      userId,
      nickname,
      championName,
      championLevel
    });

    const message: ChatMessage = {
      id: createMessageId(),
      userId,
      nickname,
      championName,
      championLevel,
      text,
      timestamp: Date.now()
    };

    this.history.addMessage(message);
    this.broadcast(CHAT_MESSAGE_EVENT, message);
  }

  private handleTeamInvite(client: Client, payload: TeamInvitePayload): void {
    const inviter = this.participantBySessionId.get(client.sessionId);
    if (!inviter) {
      this.sendTeamError(client, "INVALID_INVITER", "Convite inválido para este jogador.");
      return;
    }

    const fromUserId = normalizeUserId(payload?.fromUserId);
    if (!fromUserId || fromUserId !== inviter.userId) {
      this.sendTeamError(client, "INVALID_INVITER", "Convite inválido para este jogador.");
      return;
    }

    const toUserId = normalizeUserId(payload?.toUserId);
    if (!toUserId) {
      this.sendTeamError(client, "INVALID_TARGET", "Jogador alvo inválido.");
      return;
    }

    if (toUserId === inviter.userId) {
      this.sendTeamError(client, "SELF_INVITE", "Você não pode convidar a si mesmo.");
      return;
    }

    const targetParticipant = this.getPrimaryParticipantByUserId(toUserId);
    if (!targetParticipant) {
      this.sendTeamError(client, "TARGET_OFFLINE", "Jogador não está online.");
      return;
    }

    if (this.inviteService.isCooldownActive(inviter.userId, Date.now())) {
      this.sendTeamError(client, "INVITE_COOLDOWN", "Aguarde 2 segundos para enviar outro convite.");
      return;
    }

    const inviterTeam = this.teamService.getTeamByUserId(inviter.userId);
    if (inviterTeam && inviterTeam.members.length >= TEAM_MAX_MEMBERS) {
      this.sendTeamError(client, "TEAM_FULL", "Time cheio.");
      return;
    }

    if (this.teamService.hasUserInTeam(toUserId)) {
      this.sendTeamError(client, "TARGET_ALREADY_IN_TEAM", "Esse jogador já está em um time.");
      return;
    }

    if (this.inviteService.hasPendingInviteBetween(inviter.userId, toUserId, Date.now())) {
      this.sendTeamError(client, "INVITE_ALREADY_PENDING", "Já existe um convite pendente entre vocês.");
      return;
    }

    const team = inviterTeam ?? this.teamService.createTeam({
      userId: inviter.userId,
      nickname: inviter.nickname
    });

    if (!inviterTeam) {
      this.broadcastTeamUpdated(team);
    }

    const invite = this.inviteService.createInvite({
      fromUserId: inviter.userId,
      fromNickname: inviter.nickname,
      toUserId,
      toNickname: targetParticipant.nickname,
      teamId: team.id
    });

    this.sendToUser(inviter.userId, TEAM_INVITE_SENT_EVENT, {
      inviteId: invite.id,
      toUserId,
      toNickname: targetParticipant.nickname
    });

    this.sendToUser(toUserId, TEAM_INVITE_RECEIVED_EVENT, this.toInviteReceivedPayload(invite));
  }

  private handleTeamAccept(client: Client, payload: TeamInviteActionPayload): void {
    const invitedParticipant = this.participantBySessionId.get(client.sessionId);
    if (!invitedParticipant) {
      this.sendTeamError(client, "INVALID_INVITE", "Convite inválido.");
      return;
    }

    const inviteId = normalizeInviteId(payload?.inviteId);
    if (!inviteId) {
      this.sendTeamError(client, "INVALID_INVITE", "Convite inválido.");
      return;
    }

    const invite = this.inviteService.getInviteById(inviteId);
    if (!invite) {
      this.sendTeamError(client, "INVITE_NOT_FOUND", "Convite não encontrado.");
      return;
    }

    if (invite.status !== "pending") {
      this.sendTeamError(client, "INVITE_NOT_PENDING", "Convite já foi processado.");
      return;
    }

    const nowMs = Date.now();
    if (invite.expiresAt <= nowMs) {
      this.inviteService.markExpired(invite.id);
      this.sendTeamError(client, "INVITE_EXPIRED", "Convite expirado.");
      return;
    }

    if (invite.toUserId !== invitedParticipant.userId) {
      this.sendTeamError(client, "NOT_INVITED_USER", "Você não é o destinatário deste convite.");
      return;
    }

    if (this.teamService.hasUserInTeam(invitedParticipant.userId)) {
      this.inviteService.markExpired(invite.id);
      this.sendTeamError(client, "TARGET_ALREADY_IN_TEAM", "Esse jogador já está em um time.");
      return;
    }

    const inviterTeam = this.teamService.getTeamById(invite.teamId);
    if (!inviterTeam) {
      this.inviteService.markExpired(invite.id);
      this.sendTeamError(client, "TEAM_NOT_FOUND", "Time não encontrado.");
      return;
    }

    if (inviterTeam.members.length >= TEAM_MAX_MEMBERS) {
      this.inviteService.markExpired(invite.id);
      this.sendTeamError(client, "TEAM_FULL", "Time cheio.");
      return;
    }

    const updatedTeam = this.teamService.addMember(
      inviterTeam.id,
      {
        userId: invitedParticipant.userId,
        nickname: invitedParticipant.nickname
      },
      nowMs
    );

    if (!updatedTeam) {
      this.sendTeamError(client, "TEAM_JOIN_FAILED", "Não foi possível entrar no time.");
      return;
    }

    this.inviteService.markAccepted(invite.id);
    this.inviteService.expirePendingInvitesForUser(invitedParticipant.userId, "expired");

    if (updatedTeam.members.length >= TEAM_MAX_MEMBERS) {
      this.inviteService.expirePendingInvitesForTeam(updatedTeam.id, "expired");
    }

    this.broadcastTeamUpdated(updatedTeam);
  }

  private handleTeamDecline(client: Client, payload: TeamInviteActionPayload): void {
    const invitedParticipant = this.participantBySessionId.get(client.sessionId);
    if (!invitedParticipant) {
      this.sendTeamError(client, "INVALID_INVITE", "Convite inválido.");
      return;
    }

    const inviteId = normalizeInviteId(payload?.inviteId);
    if (!inviteId) {
      this.sendTeamError(client, "INVALID_INVITE", "Convite inválido.");
      return;
    }

    const invite = this.inviteService.getInviteById(inviteId);
    if (!invite) {
      this.sendTeamError(client, "INVITE_NOT_FOUND", "Convite não encontrado.");
      return;
    }

    if (invite.status !== "pending") {
      this.sendTeamError(client, "INVITE_NOT_PENDING", "Convite já foi processado.");
      return;
    }

    if (invite.expiresAt <= Date.now()) {
      this.inviteService.markExpired(invite.id);
      this.sendTeamError(client, "INVITE_EXPIRED", "Convite expirado.");
      return;
    }

    if (invite.toUserId !== invitedParticipant.userId) {
      this.sendTeamError(client, "NOT_INVITED_USER", "Você não é o destinatário deste convite.");
      return;
    }

    this.inviteService.markDeclined(invite.id);

    this.sendToUser(invite.fromUserId, TEAM_INVITE_DECLINED_EVENT, {
      inviteId: invite.id,
      byUserId: invitedParticipant.userId,
      byNickname: invitedParticipant.nickname
    });
  }

  private handleTeamKick(client: Client, payload: TeamKickPayload): void {
    const actor = this.participantBySessionId.get(client.sessionId);
    if (!actor) {
      this.sendTeamError(client, "TEAM_REQUIRED", "Você não está em um time.");
      return;
    }

    const targetUserId = normalizeUserId(payload?.targetUserId);
    if (!targetUserId) {
      this.sendTeamError(client, "INVALID_TARGET", "Jogador alvo inválido.");
      return;
    }

    const team = this.teamService.getTeamByUserId(actor.userId);
    if (!team) {
      this.sendTeamError(client, "TEAM_REQUIRED", "Você não está em um time.");
      return;
    }

    if (team.leaderUserId !== actor.userId) {
      this.sendTeamError(client, "LEADER_REQUIRED", "Apenas o líder pode remover jogadores.");
      return;
    }

    if (targetUserId === actor.userId) {
      this.sendTeamError(client, "LEADER_CANNOT_KICK_SELF", "O líder não pode remover a si mesmo.");
      return;
    }

    const targetMember = team.members.find((member) => member.userId === targetUserId);
    if (!targetMember) {
      this.sendTeamError(client, "TARGET_NOT_IN_TEAM", "Jogador não está no seu time.");
      return;
    }

    this.clearPendingOfflineCleanup(targetUserId);

    const leaveResult = this.teamService.removeMember(targetUserId);
    if (!leaveResult) {
      this.sendTeamError(client, "TARGET_NOT_IN_TEAM", "Jogador não está no seu time.");
      return;
    }

    this.sendToUser(targetUserId, TEAM_KICKED_EVENT, {
      byUserId: actor.userId,
      byNickname: actor.nickname
    });

    this.sendToUser(targetUserId, TEAM_LEFT_EVENT, {
      byUserId: actor.userId,
      byNickname: actor.nickname
    });

    if (leaveResult.team) {
      this.broadcastTeamUpdated(leaveResult.team);
    }
  }

  private handleTeamLeave(client: Client, payload: TeamLeavePayload): void {
    const leaver = this.participantBySessionId.get(client.sessionId);
    if (!leaver) {
      this.sendTeamError(client, "TEAM_REQUIRED", "Você não está em um time.");
      return;
    }

    const userId = normalizeUserId(payload?.userId);
    if (!userId || userId !== leaver.userId) {
      this.sendTeamError(client, "INVALID_LEAVER", "Solicitação inválida para sair do time.");
      return;
    }

    const team = this.teamService.getTeamByUserId(leaver.userId);
    if (!team) {
      this.sendTeamError(client, "TEAM_REQUIRED", "Você não está em um time.");
      return;
    }

    this.clearPendingOfflineCleanup(leaver.userId);

    const leaveResult = this.teamService.removeMember(leaver.userId);
    if (!leaveResult) {
      this.sendTeamError(client, "TEAM_REQUIRED", "Você não está em um time.");
      return;
    }

    this.sendToUser(leaver.userId, TEAM_LEFT_EVENT, {
      byUserId: leaver.userId,
      byNickname: leaver.nickname
    });

    if (!leaveResult.team) {
      this.inviteService.expirePendingInvitesForTeam(leaveResult.teamId, "expired");
      return;
    }

    this.broadcastTeamUpdated(leaveResult.team);
  }

  private sendChatError(client: Client, code: ChatErrorCode, message: string): void {
    client.send(CHAT_ERROR_EVENT, {
      code,
      message,
      timestamp: Date.now()
    });
  }

  private sendTeamError(client: Client, code: TeamErrorCode, message: string): void {
    client.send(TEAM_ERROR_EVENT, {
      code,
      message,
      timestamp: Date.now()
    });
  }

  private isUserOnline(userId: string): boolean {
    return (this.sessionIdsByUserId.get(userId)?.size ?? 0) > 0;
  }

  private broadcastChatPresence(): void {
    this.broadcast(CHAT_PRESENCE_EVENT, {
      onlineUsers: this.sessionIdsByUserId.size,
      connectedSessions: this.participantBySessionId.size,
      timestamp: Date.now()
    });
  }

  private clearPendingOfflineCleanup(userId: string): void {
    const timeoutId = this.pendingOfflineCleanupByUserId.get(userId);
    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    this.pendingOfflineCleanupByUserId.delete(userId);
  }

  private scheduleOfflineCleanup(userId: string): void {
    this.clearPendingOfflineCleanup(userId);

    const timeoutId = setTimeout(() => {
      this.pendingOfflineCleanupByUserId.delete(userId);
      this.finalizeOfflineUser(userId);
    }, TEAM_RECONNECT_GRACE_MS);

    this.pendingOfflineCleanupByUserId.set(userId, timeoutId);
  }

  private finalizeOfflineUser(userId: string): void {
    if (this.isUserOnline(userId)) {
      return;
    }

    this.inviteService.expirePendingInvitesForUser(userId, "expired");

    const leaveResult = this.teamService.removeMember(userId);
    if (!leaveResult) {
      return;
    }

    if (!leaveResult.team) {
      this.inviteService.expirePendingInvitesForTeam(leaveResult.teamId, "expired");
      return;
    }

    this.broadcastTeamUpdated(leaveResult.team);
  }

  private getPrimaryParticipantByUserId(userId: string): ChatParticipant | null {
    const sessionIds = this.sessionIdsByUserId.get(userId);
    if (!sessionIds || sessionIds.size === 0) {
      return null;
    }

    const firstSessionId = sessionIds.values().next().value;
    if (typeof firstSessionId !== "string") {
      return null;
    }

    return this.participantBySessionId.get(firstSessionId) ?? null;
  }

  private sendToUser(userId: string, eventName: string, payload: unknown): void {
    const sessionIds = this.sessionIdsByUserId.get(userId);
    if (!sessionIds) {
      return;
    }

    sessionIds.forEach((sessionId) => {
      const client = this.clientBySessionId.get(sessionId);
      client?.send(eventName, payload);
    });
  }

  private broadcastTeamUpdated(team: Team): void {
    team.members.forEach((member) => {
      this.sendToUser(member.userId, TEAM_UPDATED_EVENT, { team });
    });
  }

  private toInviteReceivedPayload(invite: TeamInvite): Record<string, unknown> {
    return {
      inviteId: invite.id,
      fromUserId: invite.fromUserId,
      fromNickname: invite.fromNickname,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      teamId: invite.teamId,
      toUserId: invite.toUserId,
      toNickname: invite.toNickname
    };
  }
}
