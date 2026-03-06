export class AntiSpamService {
  private readonly lastMessageAtByUserId = new Map<string, number>();

  constructor(private readonly cooldownMs: number = 1000) {}

  canSend(userId: string, nowMs: number = Date.now()): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }

    const lastMessageAt = this.lastMessageAtByUserId.get(normalizedUserId);
    if (lastMessageAt !== undefined && nowMs - lastMessageAt < this.cooldownMs) {
      return false;
    }

    this.lastMessageAtByUserId.set(normalizedUserId, nowMs);
    return true;
  }
}
