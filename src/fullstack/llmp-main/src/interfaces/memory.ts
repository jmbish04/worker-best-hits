import { MessageRole, DatabaseMessage } from "@/types";
import Logger from "@/interfaces/logger";

abstract class Memory {
  protected logger: Logger;
  messageLimit: number;
  protected userId: string;

  constructor({
    logger,
    messageLimit = 10,
    userId,
  }: {
    messageLimit?: number,
    logger: Logger
    userId: string,
  }) {
    this.logger = logger;
    this.messageLimit = messageLimit;
    this.userId = userId;
  }

  abstract getPreviousMessages(limit: number): Promise<string[]>;
  abstract saveMessage(
    message: string,
    role: MessageRole
  ): Promise<number>;
  abstract getMessageById(
    messageId: number
  ): Promise<DatabaseMessage | null>;
}

export default Memory;