export interface ThreadRecord {
  id: string;
  title: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function createThreadStore() {
  return {
    async listThreads(db: D1Database): Promise<ThreadRecord[]> {
      const { results } = await db.prepare(`SELECT id, title, updated_at as updatedAt FROM threads ORDER BY updated_at DESC`).all<ThreadRecord>();
      return results ?? [];
    },

    async listMessages(db: D1Database, threadId: string): Promise<MessageRecord[]> {
      const { results } = await db
        .prepare(`SELECT id, thread_id as threadId, role, content, created_at as createdAt FROM messages WHERE thread_id = ? ORDER BY created_at ASC`)
        .bind(threadId)
        .all<MessageRecord>();
      return results ?? [];
    },

    async createThread(db: D1Database, prompt: string): Promise<string> {
      const id = crypto.randomUUID();
      await db.prepare(`INSERT INTO threads (id, title, updated_at) VALUES (?, ?, datetime('now'))`).bind(id, prompt.slice(0, 80)).run();
      return id;
    },

    async appendMessage(db: D1Database, message: { threadId: string; role: "user" | "assistant"; content: string }) {
      const id = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, message.threadId, message.role, message.content)
        .run();
      await db.prepare(`UPDATE threads SET updated_at = datetime('now') WHERE id = ?`).bind(message.threadId).run();
    }
  };
}

export interface PromptRecord {
  id: string;
  content: string;
  isActive: number;
  modifiedPromptId?: string | null;
  dateModified?: string | null;
  dateLastSeen?: string | null;
}

export function createPromptRepository() {
  return {
    async sync(db: D1Database, prompts: Array<{ id: string; content: string }>) {
      for (const prompt of prompts) {
        await db
          .prepare(
            `INSERT INTO assistant_prompts (id, content, is_active) VALUES (?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET content = excluded.content, is_active = 1`
          )
          .bind(prompt.id, prompt.content)
          .run();
      }
      return { inserted: prompts.length };
    },

    async markModified(db: D1Database, previousPromptId: string, modifiedPromptId: string) {
      await db
        .prepare(`UPDATE assistant_prompts SET modified_prompt_id = ?, date_modified = datetime('now'), is_active = 0 WHERE id = ?`)
        .bind(modifiedPromptId, previousPromptId)
        .run();
    },

    async markLastSeen(db: D1Database, promptId: string, lastSeen: string) {
      await db
        .prepare(`UPDATE assistant_prompts SET date_last_seen = ? WHERE id = ?`)
        .bind(lastSeen, promptId)
        .run();
    }
  };
}

export interface RepositoryDigestRecord {
  owner: string;
  name: string;
  summary: string;
  createdAt: string;
}

export function createDigestRepository() {
  return {
    async store(db: D1Database, digests: RepositoryDigestRecord[]) {
      for (const digest of digests) {
        await db
          .prepare(
            `INSERT INTO repository_digests (id, owner, name, summary, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`
          )
          .bind(crypto.randomUUID(), digest.owner, digest.name, digest.summary)
          .run();
      }
    }
  };
}
