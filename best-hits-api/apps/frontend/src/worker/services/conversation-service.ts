import { createDurableAgent } from "@cloudflare/agent";
import { createThreadStore } from "@cloudflare/data";

/**
 * ConversationService orchestrates multi-turn chat threads using the Cloudflare
 * Agents SDK and Durable Objects to ensure continuity across worker invocations.
 */
export function createConversationService() {
  const agent = createDurableAgent();
  const threadStore = createThreadStore();

  return {
    async listThreads(env: Env) {
      return threadStore.listThreads(env.DB);
    },

    async listMessages(env: Env, threadId: string) {
      return threadStore.listMessages(env.DB, threadId);
    },

    async submitPrompt(env: Env, prompt: string, threadId: string | null) {
      const activeThreadId = threadId ?? (await threadStore.createThread(env.DB, prompt));
      const session = agent.bind(env, activeThreadId);
      await threadStore.appendMessage(env.DB, {
        threadId: activeThreadId,
        role: "user",
        content: prompt
      });
      const response = await session.run({ prompt });
      await threadStore.appendMessage(env.DB, {
        threadId: activeThreadId,
        role: "assistant",
        content: response.output
      });
      return activeThreadId;
    }
  };
}