import type { ChatMessage } from "../models/chat-message.model.js";

export class ChatHistoryService {
  private readonly messages: ChatMessage[] = [];

  constructor(private readonly maxMessages: number = 100) {}

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.clearIfNeeded();
  }

  getHistory(): ChatMessage[] {
    return [...this.messages];
  }

  clearIfNeeded(): void {
    if (this.messages.length <= this.maxMessages) {
      return;
    }

    this.messages.splice(0, this.messages.length - this.maxMessages);
  }
}
