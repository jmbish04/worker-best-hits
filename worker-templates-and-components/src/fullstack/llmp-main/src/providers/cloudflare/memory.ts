import { D1Database } from "@cloudflare/workers-types";

import { MessageRole, DatabaseMessage } from "@/types";
import Logger from "@/interfaces/logger";
import Memory from "@/interfaces/memory";

class CloudflareMemory extends Memory {
  private db: D1Database;

  constructor(
    {
      db,
      logger,
      messageLimit,
      userId,
    }: {
      db: D1Database,
      logger: Logger,
      messageLimit?: number,
      userId: string,
    }) {
    super({ logger, messageLimit, userId });
    this.db = db;
    this.checkTableExists();
  }

  async checkTableExists(): Promise<void> {
    this.logger.debug("Checking if table 'messages' exists in the database...");
    const query = `SELECT 1 FROM messages LIMIT 1`;
    try {
      await this.db.prepare(query).all();
      this.logger.debug("Table 'messages' exists in the database");
    } catch (error: any) {
      if (error && error.message.includes('no such table')) {
        this.logger.error("Table 'messages' does not exist in the database", { error });
        throw new Error("Table 'messages' does not exist in the database.");
      } else {
        this.logger.error('Error checking if table exists', { error });
        throw error;
      }
    }
  }

  async getPreviousMessages(limit: number): Promise<string[]> {
    this.logger.debug('Fetching previous messages', { userId: this.userId, limit });
    const query = `SELECT message FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
    try {
      const resp = await this.db.prepare(query).bind(this.userId, limit).all();
      const messages = resp.results.map((r: any) => r.message);
      this.logger.debug('Previous messages fetched', { count: messages.length });
      return messages;
    } catch (error) {
      this.logger.error('Error fetching previous messages', { error });
      return [];
    }
  }

  async saveMessage(
    message: string,
    role: MessageRole
  ): Promise<number> {
    this.logger.debug('Saving message', { userId: this.userId, role });
    const insertQuery = `INSERT INTO messages (user_id, message, role) VALUES (?, ?, ?) RETURNING id`;
    try {
      const resp = await this.db
        .prepare(insertQuery)
        .bind(this.userId, message, role)
        .first();
      if (resp && resp.id) {
        this.logger.debug('Message saved', { messageId: resp.id });
        return (resp as any).id;
      } else {
        this.logger.error('Failed to save message');
        throw new Error('Failed to save message.');
      }
    } catch (error) {
      this.logger.error('Error saving message', { error });
      throw error;
    }
  }

  async getMessageById(
    messageId: number
  ): Promise<DatabaseMessage | null> {
    this.logger.debug('Fetching message by ID', { messageId });
    const query = `SELECT * FROM messages WHERE id = ?`;
    try {
      const resp = await this.db.prepare(query).bind(messageId).first<DatabaseMessage>();
      if (resp) {
        this.logger.debug('Message fetched', { messageId });
        return resp;
      } else {
        this.logger.warn('Message not found', { messageId });
        return null;
      }
    } catch (error) {
      this.logger.error('Error fetching message by ID', { error });
      return null;
    }
  }
}

export default CloudflareMemory;