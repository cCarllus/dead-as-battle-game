const KEY_SESSION = "dab.session";

type SessionSnapshot = {
  userId: string;
  nickname: string;
  startedAt: string;
  lastSeenAt: string;
};

function isValidSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as SessionSnapshot;
  return (
    typeof session.userId === "string" &&
    session.userId.length > 0 &&
    typeof session.nickname === "string" &&
    session.nickname.length > 0 &&
    typeof session.startedAt === "string" &&
    typeof session.lastSeenAt === "string"
  );
}

export function getSessionSnapshot(): SessionSnapshot | null {
  const raw = sessionStorage.getItem(KEY_SESSION);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidSessionSnapshot(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function startSession(userId: string, nickname: string): void {
  const normalizedUserId = userId.trim();
  const normalizedNickname = nickname.trim();

  if (!normalizedUserId || !normalizedNickname) {
    return;
  }

  const now = new Date().toISOString();
  const previous = getSessionSnapshot();

  const snapshot: SessionSnapshot = {
    userId: normalizedUserId,
    nickname: normalizedNickname,
    startedAt: previous?.startedAt ?? now,
    lastSeenAt: now
  };

  sessionStorage.setItem(KEY_SESSION, JSON.stringify(snapshot));
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY_SESSION);
}
