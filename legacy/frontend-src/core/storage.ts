// Responsável por manter e validar o estado de sessão ativa no sessionStorage.
export type SessionSnapshot = {
  userId: string;
  nickname: string;
  startedAt: string;
  lastSeenAt: string;
};

export type SessionStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SessionService = {
  getSnapshot: () => SessionSnapshot | null;
  start: (userId: string, nickname: string) => void;
  clear: () => void;
  isActiveForUser: (userId: string) => boolean;
};

const SESSION_STORAGE_KEY = "dab.session";

function isValidSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as SessionSnapshot;

  return (
    typeof snapshot.userId === "string" &&
    snapshot.userId.length > 0 &&
    typeof snapshot.nickname === "string" &&
    snapshot.nickname.length > 0 &&
    typeof snapshot.startedAt === "string" &&
    typeof snapshot.lastSeenAt === "string"
  );
}

function parseSessionSnapshot(rawValue: string): SessionSnapshot | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isValidSessionSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createSessionService(
  storage: SessionStorageAdapter = sessionStorage,
  storageKey: string = SESSION_STORAGE_KEY
): SessionService {
  const getSnapshot = (): SessionSnapshot | null => {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    return parseSessionSnapshot(rawValue);
  };

  return {
    getSnapshot,
    start: (userId, nickname) => {
      const normalizedUserId = userId.trim();
      const normalizedNickname = nickname.trim();

      if (!normalizedUserId || !normalizedNickname) {
        return;
      }

      const now = new Date().toISOString();
      const previousSnapshot = getSnapshot();

      const nextSnapshot: SessionSnapshot = {
        userId: normalizedUserId,
        nickname: normalizedNickname,
        startedAt: previousSnapshot?.startedAt ?? now,
        lastSeenAt: now
      };

      storage.setItem(storageKey, JSON.stringify(nextSnapshot));
    },
    clear: () => {
      storage.removeItem(storageKey);
    },
    isActiveForUser: (userId) => {
      const snapshot = getSnapshot();
      return snapshot?.userId === userId.trim();
    }
  };
}

const defaultSessionService = createSessionService();

export function getSessionSnapshot(): SessionSnapshot | null {
  return defaultSessionService.getSnapshot();
}

export function startSession(userId: string, nickname: string): void {
  defaultSessionService.start(userId, nickname);
}

export function clearSession(): void {
  defaultSessionService.clear();
}

export function isSessionActiveForUser(userId: string): boolean {
  return defaultSessionService.isActiveForUser(userId);
}
