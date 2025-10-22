import { D1Database, Vectorize } from "@cloudflare/workers-types";

import Logger from "@/interfaces/logger";
import RAG from "@/interfaces/rag";

class CloudflareRAG extends RAG {
  private vectorIndex: Vectorize;
  private db: D1Database;

  constructor(
    vectorIndex: Vectorize,
    db: D1Database,
    userId: string,
    logger: Logger
  ) {
    super(userId, logger);
    this.vectorIndex = vectorIndex;
    this.db = db;
  }

  async retrieveRelevantTexts(
    queryEmbedding: number[],
    topK: number
  ): Promise<string[]> {
    this.logger.debug('Retrieving relevant texts using RAG', { userId: this.userId, topK });
    try {
      const resp = await this.vectorIndex.query(queryEmbedding, {
        namespace: `messages:${this.userId}`,
        topK,
      });

      const messageIds = resp.matches.map((match: any) => match.id);
      this.logger.debug('Relevant message IDs retrieved', { messageIds });

      if (messageIds.length === 0) {
        this.logger.debug('No relevant messages found');
        return [];
      }

      // Fetch messages by IDs from the database
      const placeholders = messageIds.map(() => '?').join(',');
      const messagesQuery = `SELECT message FROM messages WHERE id IN (${placeholders})`;
      const messagesResp = await this.db
        .prepare(messagesQuery)
        .bind(...messageIds)
        .all();

      const messages = messagesResp.results.map((r: any) => r.message);
      this.logger.debug('Relevant messages fetched from database', { count: messages.length });
      return messages;
    } catch (error) {
      this.logger.error('Error retrieving relevant texts', { error });
      return [];
    }
  }

  async storeEmbedding(id: string, embedding: number[]): Promise<void> {
    this.logger.debug('Storing embedding in vector index', { id });
    try {
      await this.vectorIndex.upsert([
        {
          id,
          namespace: `messages:${this.userId}`,
          values: embedding,
        },
      ]);
      this.logger.debug('Embedding stored successfully', { id });
    } catch (error) {
      this.logger.error('Error storing embedding', { error });
      throw error;
    }
  }
}

export default CloudflareRAG;