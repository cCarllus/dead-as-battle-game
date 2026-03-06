import { Client, Room } from "@colyseus/sdk";
import type { Team } from "../models/team.model";
import type { TeamInvite } from "../models/team-invite.model";
import { GLOBAL_CHAT_ROOM_NAME } from "./chat.service";

type TeamInviteSentPayload = {
  inviteId: string;
  toUserId: string;
  toNickname: string;
};

type TeamInviteReceivedPayload = {
  inviteId: string;
  fromUserId: string;
  fromNickname: string;
  expiresAt: number;
  createdAt?: number;
  teamId?: string;
  toUserId?: string;
  toNickname?: string;
};

type TeamInviteDeclinedPayload = {
  inviteId: string;
  byUserId: string;
  byNickname: string;
};

type TeamUpdatedPayload = {
  team: Team;
};

export type TeamIdentity = {
  userId: string;
  nickname: string;
  championName?: string;
  championLevel?: number;
};

export type TeamError = {
  code: string;
  message: string;
  timestamp: number;
};

export type TeamToast = {
  message: string;
  tone: "info" | "success" | "error";
};

export type TeamServiceOptions = {
  endpoint?: string;
  roomName?: string;
  getIdentity: () => TeamIdentity | null;
};

export type TeamService = {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendInvite: (userId: string) => void;
  acceptInvite: (inviteId: string) => void;
  declineInvite: (inviteId: string) => void;
  kickPlayer: (userId: string) => void;
  leaveTeam: () => void;
  getCurrentTeam: () => Team | null;
  getPendingInvites: () => readonly TeamInvite[];
  onTeamUpdated: (callback: (team: Team | null) => void) => () => void;
  onPendingInvitesUpdated: (callback: (invites: readonly TeamInvite[]) => void) => () => void;
  onError: (callback: (error: TeamError) => void) => () => void;
  onToast: (callback: (toast: TeamToast) => void) => () => void;
};

function resolveDefaultEndpoint(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:2567`;
}

function normalizeIdentity(rawIdentity: TeamIdentity | null): TeamIdentity | null {
  if (!rawIdentity) {
    return null;
  }

  const userId = rawIdentity.userId.trim();
  const nickname = rawIdentity.nickname.trim();

  if (!userId || !nickname) {
    return null;
  }

  return {
    userId,
    nickname,
    championName: rawIdentity.championName?.trim(),
    championLevel:
      typeof rawIdentity.championLevel === "number" && Number.isFinite(rawIdentity.championLevel)
        ? Math.max(1, Math.floor(rawIdentity.championLevel))
        : 1
  };
}

function normalizeTeamMember(value: unknown): Team["members"][number] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const member = value as Partial<Team["members"][number]>;

  if (
    typeof member.userId !== "string" ||
    typeof member.nickname !== "string" ||
    typeof member.joinedAt !== "number"
  ) {
    return null;
  }

  return {
    userId: member.userId,
    nickname: member.nickname,
    joinedAt: member.joinedAt
  };
}

function normalizeTeam(value: unknown): Team | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const team = value as Partial<Team>;

  if (
    typeof team.id !== "string" ||
    typeof team.leaderUserId !== "string" ||
    typeof team.createdAt !== "number" ||
    !Array.isArray(team.members)
  ) {
    return null;
  }

  const members = team.members
    .map((member) => normalizeTeamMember(member))
    .filter((member): member is Team["members"][number] => member !== null);

  return {
    id: team.id,
    leaderUserId: team.leaderUserId,
    createdAt: team.createdAt,
    members
  };
}

function normalizeTeamUpdatedPayload(value: unknown): Team | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<TeamUpdatedPayload>;
  return normalizeTeam(payload.team);
}

function normalizeTeamInviteReceivedPayload(
  value: unknown,
  identity: TeamIdentity
): TeamInvite | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<TeamInviteReceivedPayload>;

  if (
    typeof payload.inviteId !== "string" ||
    typeof payload.fromUserId !== "string" ||
    typeof payload.fromNickname !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    return null;
  }

  const now = Date.now();
  const createdAt = typeof payload.createdAt === "number" ? payload.createdAt : now;

  return {
    id: payload.inviteId,
    fromUserId: payload.fromUserId,
    fromNickname: payload.fromNickname,
    toUserId: typeof payload.toUserId === "string" ? payload.toUserId : identity.userId,
    toNickname: typeof payload.toNickname === "string" ? payload.toNickname : identity.nickname,
    teamId: typeof payload.teamId === "string" ? payload.teamId : "",
    createdAt,
    expiresAt: payload.expiresAt,
    status: "pending"
  };
}

function normalizeTeamInviteSentPayload(value: unknown): TeamInviteSentPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<TeamInviteSentPayload>;

  if (
    typeof payload.inviteId !== "string" ||
    typeof payload.toUserId !== "string" ||
    typeof payload.toNickname !== "string"
  ) {
    return null;
  }

  return {
    inviteId: payload.inviteId,
    toUserId: payload.toUserId,
    toNickname: payload.toNickname
  };
}

function normalizeTeamInviteDeclinedPayload(value: unknown): TeamInviteDeclinedPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<TeamInviteDeclinedPayload>;

  if (
    typeof payload.inviteId !== "string" ||
    typeof payload.byUserId !== "string" ||
    typeof payload.byNickname !== "string"
  ) {
    return null;
  }

  return {
    inviteId: payload.inviteId,
    byUserId: payload.byUserId,
    byNickname: payload.byNickname
  };
}

function normalizeTeamError(value: unknown): TeamError {
  if (!value || typeof value !== "object") {
    return {
      code: "UNKNOWN",
      message: "Erro inesperado no sistema de time.",
      timestamp: Date.now()
    };
  }

  const error = value as Partial<TeamError>;

  return {
    code: typeof error.code === "string" ? error.code : "UNKNOWN",
    message: typeof error.message === "string" ? error.message : "Erro inesperado no sistema de time.",
    timestamp: typeof error.timestamp === "number" ? error.timestamp : Date.now()
  };
}

function resolveTeamErrorToast(error: TeamError): string {
  switch (error.code) {
    case "TEAM_FULL":
      return "Time cheio";
    case "TARGET_ALREADY_IN_TEAM":
      return "Esse jogador já está em um time";
    case "INVITE_COOLDOWN":
      return "Aguarde 2 segundos para enviar outro convite";
    case "INVITE_ALREADY_PENDING":
      return "Já existe um convite pendente entre vocês";
    case "INVITE_EXPIRED":
      return "Convite expirado";
    default:
      return error.message;
  }
}

function compareByExpiration(left: TeamInvite, right: TeamInvite): number {
  return left.expiresAt - right.expiresAt;
}

function cloneTeam(team: Team | null): Team | null {
  if (!team) {
    return null;
  }

  return {
    id: team.id,
    leaderUserId: team.leaderUserId,
    createdAt: team.createdAt,
    members: team.members.map((member) => ({
      userId: member.userId,
      nickname: member.nickname,
      joinedAt: member.joinedAt
    }))
  };
}

export function createTeamService(options: TeamServiceOptions): TeamService {
  const endpoint = options.endpoint ?? resolveDefaultEndpoint();
  const roomName = options.roomName ?? GLOBAL_CHAT_ROOM_NAME;

  const client = new Client(endpoint);
  let room: Room | null = null;
  let connectPromise: Promise<void> | null = null;
  let suppressNextDisconnectError = false;

  let currentTeam: Team | null = null;
  let pendingInvites: TeamInvite[] = [];
  let inviteExpiryTimeoutId: number | null = null;

  const teamListeners = new Set<(team: Team | null) => void>();
  const pendingInvitesListeners = new Set<(invites: readonly TeamInvite[]) => void>();
  const errorListeners = new Set<(error: TeamError) => void>();
  const toastListeners = new Set<(toast: TeamToast) => void>();

  const emitTeam = (team: Team | null): void => {
    const snapshot = cloneTeam(team);
    teamListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitPendingInvites = (): void => {
    const snapshot = pendingInvites
      .slice()
      .sort(compareByExpiration)
      .map((invite) => ({ ...invite }));

    pendingInvitesListeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const emitError = (error: TeamError): void => {
    errorListeners.forEach((listener) => {
      listener(error);
    });
  };

  const emitToast = (toast: TeamToast): void => {
    toastListeners.forEach((listener) => {
      listener(toast);
    });
  };

  const clearInviteExpiryTimeout = (): void => {
    if (inviteExpiryTimeoutId !== null) {
      window.clearTimeout(inviteExpiryTimeoutId);
      inviteExpiryTimeoutId = null;
    }
  };

  const pruneExpiredPendingInvites = (nowMs: number = Date.now()): boolean => {
    const nextInvites = pendingInvites.filter((invite) => invite.status === "pending" && invite.expiresAt > nowMs);

    if (nextInvites.length === pendingInvites.length) {
      return false;
    }

    pendingInvites = nextInvites;
    return true;
  };

  const scheduleInviteExpirySweep = (): void => {
    clearInviteExpiryTimeout();

    if (pendingInvites.length === 0) {
      return;
    }

    const nowMs = Date.now();
    const nextExpiration = pendingInvites.reduce((closest, invite) => {
      return Math.min(closest, invite.expiresAt);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nextExpiration)) {
      return;
    }

    const delay = Math.max(50, nextExpiration - nowMs + 10);

    inviteExpiryTimeoutId = window.setTimeout(() => {
      if (pruneExpiredPendingInvites(Date.now())) {
        emitPendingInvites();
      }
      scheduleInviteExpirySweep();
    }, delay);
  };

  const setPendingInvites = (nextInvites: TeamInvite[]): void => {
    pendingInvites = nextInvites
      .filter((invite) => invite.status === "pending")
      .sort(compareByExpiration);

    pruneExpiredPendingInvites(Date.now());
    scheduleInviteExpirySweep();
    emitPendingInvites();
  };

  const upsertPendingInvite = (invite: TeamInvite): void => {
    const nextInvites = pendingInvites.filter((entry) => entry.id !== invite.id);
    nextInvites.push(invite);
    setPendingInvites(nextInvites);
  };

  const removePendingInviteById = (inviteId: string): void => {
    const nextInvites = pendingInvites.filter((invite) => invite.id !== inviteId);
    if (nextInvites.length === pendingInvites.length) {
      return;
    }

    setPendingInvites(nextInvites);
  };

  const clearTeamState = (): void => {
    currentTeam = null;
    pendingInvites = [];
    clearInviteExpiryTimeout();
    emitTeam(null);
    emitPendingInvites();
  };

  const bindRoomEvents = (connectedRoom: Room): void => {
    connectedRoom.onMessage("team:invite:sent", (payload: unknown) => {
      const inviteSent = normalizeTeamInviteSentPayload(payload);
      if (!inviteSent) {
        return;
      }

      emitToast({
        message: `Convite enviado para ${inviteSent.toNickname}`,
        tone: "success"
      });
    });

    connectedRoom.onMessage("team:invite:received", (payload: unknown) => {
      const identity = normalizeIdentity(options.getIdentity());
      if (!identity) {
        return;
      }

      const invite = normalizeTeamInviteReceivedPayload(payload, identity);
      if (!invite) {
        return;
      }

      if (invite.toUserId !== identity.userId) {
        return;
      }

      if (invite.expiresAt <= Date.now()) {
        return;
      }

      upsertPendingInvite(invite);
    });

    connectedRoom.onMessage("team:invite:declined", (payload: unknown) => {
      const declined = normalizeTeamInviteDeclinedPayload(payload);
      if (!declined) {
        return;
      }

      emitToast({
        message: `${declined.byNickname} recusou seu convite`,
        tone: "info"
      });
    });

    connectedRoom.onMessage("team:updated", (payload: unknown) => {
      const nextTeam = normalizeTeamUpdatedPayload(payload);
      if (!nextTeam) {
        return;
      }

      const identity = normalizeIdentity(options.getIdentity());
      const previousTeam = currentTeam;
      currentTeam = nextTeam;

      if (identity) {
        const previousMemberIds = new Set(previousTeam?.members.map((member) => member.userId) ?? []);

        nextTeam.members.forEach((member) => {
          if (member.userId === identity.userId) {
            return;
          }

          if (previousMemberIds.has(member.userId)) {
            return;
          }

          emitToast({
            message: `${member.nickname} entrou no time`,
            tone: "success"
          });
        });
      }

      if (identity && nextTeam.members.some((member) => member.userId === identity.userId)) {
        setPendingInvites([]);
      }

      emitTeam(currentTeam);
    });

    connectedRoom.onMessage("team:left", () => {
      currentTeam = null;
      emitTeam(currentTeam);
    });

    connectedRoom.onMessage("team:kicked", () => {
      currentTeam = null;
      emitTeam(currentTeam);

      emitToast({
        message: "Você foi removido do time",
        tone: "error"
      });
    });

    connectedRoom.onMessage("team:error", (payload: unknown) => {
      const error = normalizeTeamError(payload);
      emitError(error);
      emitToast({
        message: resolveTeamErrorToast(error),
        tone: "error"
      });
    });

    connectedRoom.onLeave(() => {
      room = null;

      if (suppressNextDisconnectError) {
        suppressNextDisconnectError = false;
        return;
      }

      clearTeamState();
      emitError({
        code: "DISCONNECTED",
        message: "Desconectado do servidor de times.",
        timestamp: Date.now()
      });
    });

    connectedRoom.onError((code, message) => {
      const error: TeamError = {
        code: String(code),
        message: message ?? "Falha ao conectar no sistema de times.",
        timestamp: Date.now()
      };

      emitError(error);
      emitToast({
        message: error.message,
        tone: "error"
      });
    });
  };

  const sendOrEmitConnectionError = (eventName: string, payload: unknown): void => {
    if (!room) {
      const error: TeamError = {
        code: "NOT_CONNECTED",
        message: "Sistema de time ainda não está conectado.",
        timestamp: Date.now()
      };

      emitError(error);
      emitToast({ message: error.message, tone: "error" });
      return;
    }

    room.send(eventName, payload);
  };

  return {
    connect: async () => {
      if (room) {
        return;
      }

      if (connectPromise) {
        return connectPromise;
      }

      connectPromise = (async () => {
        const identity = normalizeIdentity(options.getIdentity());
        if (!identity) {
          const error: TeamError = {
            code: "NO_IDENTITY",
            message: "Perfil local ausente para conectar o sistema de time.",
            timestamp: Date.now()
          };

          emitError(error);
          emitToast({ message: error.message, tone: "error" });
          throw new Error(error.message);
        }

        const connectedRoom = await client.joinOrCreate(roomName, {
          userId: identity.userId,
          nickname: identity.nickname,
          championName: identity.championName,
          championLevel: identity.championLevel
        });

        room = connectedRoom;
        bindRoomEvents(connectedRoom);
      })();

      try {
        await connectPromise;
      } finally {
        connectPromise = null;
      }
    },
    disconnect: () => {
      if (!room) {
        return;
      }

      suppressNextDisconnectError = true;
      void room.leave();
      room = null;
      clearTeamState();
    },
    sendInvite: (userId) => {
      const identity = normalizeIdentity(options.getIdentity());
      const targetUserId = userId.trim();

      if (!identity || !targetUserId) {
        return;
      }

      if (targetUserId === identity.userId) {
        emitToast({
          message: "Você não pode convidar a si mesmo",
          tone: "error"
        });
        return;
      }

      sendOrEmitConnectionError("team:invite", {
        fromUserId: identity.userId,
        toUserId: targetUserId
      });
    },
    acceptInvite: (inviteId) => {
      const normalizedInviteId = inviteId.trim();
      if (!normalizedInviteId) {
        return;
      }

      sendOrEmitConnectionError("team:accept", {
        inviteId: normalizedInviteId
      });
    },
    declineInvite: (inviteId) => {
      const normalizedInviteId = inviteId.trim();
      if (!normalizedInviteId) {
        return;
      }

      removePendingInviteById(normalizedInviteId);

      sendOrEmitConnectionError("team:decline", {
        inviteId: normalizedInviteId
      });
    },
    kickPlayer: (userId) => {
      const targetUserId = userId.trim();
      if (!targetUserId) {
        return;
      }

      sendOrEmitConnectionError("team:kick", {
        targetUserId
      });
    },
    leaveTeam: () => {
      const identity = normalizeIdentity(options.getIdentity());
      if (!identity) {
        return;
      }

      sendOrEmitConnectionError("team:leave", {
        userId: identity.userId
      });
    },
    getCurrentTeam: () => {
      return cloneTeam(currentTeam);
    },
    getPendingInvites: () => {
      return pendingInvites.map((invite) => ({ ...invite }));
    },
    onTeamUpdated: (callback) => {
      teamListeners.add(callback);
      callback(cloneTeam(currentTeam));
      return () => {
        teamListeners.delete(callback);
      };
    },
    onPendingInvitesUpdated: (callback) => {
      pendingInvitesListeners.add(callback);
      callback(pendingInvites.map((invite) => ({ ...invite })));
      return () => {
        pendingInvitesListeners.delete(callback);
      };
    },
    onError: (callback) => {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    onToast: (callback) => {
      toastListeners.add(callback);
      return () => {
        toastListeners.delete(callback);
      };
    }
  };
}
