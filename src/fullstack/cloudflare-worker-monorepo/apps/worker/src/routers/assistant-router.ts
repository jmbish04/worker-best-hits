import { json } from "itty-router";
import { createConversationService } from "../services/conversation-service";
import { createPromptSyncService } from "../services/prompt-sync-service";
import { createRepositoryDigestService } from "../services/repository-digest-service";

const conversationService = createConversationService();
const promptSyncService = createPromptSyncService();
const repositoryDigestService = createRepositoryDigestService();

export const createAssistantRouter = {
  handleListThreads: async (_request: Request, env: Env) => {
    const threads = await conversationService.listThreads(env);
    return json(threads);
  },

  handleListMessages: async (_request: Request, env: Env, context: { params: { id: string } }) => {
    const messages = await conversationService.listMessages(env, context.params.id);
    return json(messages);
  },

  handleSubmitPrompt: async (request: Request, env: Env) => {
    const body = await request.json<{ prompt: string; threadId?: string | null }>();
    const threadId = await conversationService.submitPrompt(env, body.prompt, body.threadId ?? null);
    return json({ threadId });
  },

  handleSyncPrompts: async (request: Request, env: Env) => {
    const body = await request.json<{ prompts: Array<{ id: string; content: string }> }>();
    const result = await promptSyncService.syncPrompts(env, body.prompts);
    return json(result);
  },

  handleMarkModified: async (request: Request, env: Env) => {
    const body = await request.json<{ previousPromptId: string; modifiedPromptId: string }>();
    await promptSyncService.markModified(env, body.previousPromptId, body.modifiedPromptId);
    return json({ status: "ok" });
  },

  handleMarkLastSeen: async (request: Request, env: Env) => {
    const body = await request.json<{ promptId: string; lastSeen: string }>();
    await promptSyncService.markLastSeen(env, body.promptId, body.lastSeen);
    return json({ status: "ok" });
  },

  handleIngestRepositories: async (request: Request, env: Env) => {
    const body = await request.json<{ repositories: Array<{ owner: string; name: string }> }>();
    const digest = await repositoryDigestService.ingest(env, body.repositories);
    return json(digest);
  }
};
