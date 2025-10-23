import { Router } from "itty-router";
import { createAgentHandler } from "@cloudflare/agent";
import { createAssistantRouter } from "./routers/assistant-router";
import { createTemplateRouter } from "./routers/template-router";
import { withApiKey } from "./utils/with-api-key";

export interface Env {
  WORKER_API_KEY: string;
  DB: D1Database;
  KV_CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
}

const router = Router();

router.all("/api/*", withApiKey);
router.get("/api/templates", createTemplateRouter);
router.get("/api/threads", createAssistantRouter.handleListThreads);
router.get("/api/threads/:id/messages", createAssistantRouter.handleListMessages);
router.post("/api/threads", createAssistantRouter.handleSubmitPrompt);
router.post("/api/assistant-prompts/sync", createAssistantRouter.handleSyncPrompts);
router.post("/api/assistant-prompts/mark-modified", createAssistantRouter.handleMarkModified);
router.post("/api/assistant-prompts/mark-last-seen", createAssistantRouter.handleMarkLastSeen);
router.post("/api/repository-digests/ingest", createAssistantRouter.handleIngestRepositories);

router.post("/agent/query", createAgentHandler);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    return router.handle(request, env, ctx);
  }
};
