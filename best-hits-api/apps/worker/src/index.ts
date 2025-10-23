import { Router } from "itty-router";
import { createAgentHandler } from "@cloudflare/agent";
import { assistantRouterHandlers } from "./routers/assistant-router";
import { handleListTemplates } from "./routers/template-router";
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
router.get("/api/templates", handleListTemplates);
router.get("/api/threads", assistantRouterHandlers.handleListThreads);
router.get("/api/threads/:id/messages", assistantRouterHandlers.handleListMessages);
router.post("/api/threads", assistantRouterHandlers.handleSubmitPrompt);
router.post("/api/assistant-prompts/sync", assistantRouterHandlers.handleSyncPrompts);
router.post("/api/assistant-prompts/mark-modified", assistantRouterHandlers.handleMarkModified);
router.post("/api/assistant-prompts/mark-last-seen", assistantRouterHandlers.handleMarkLastSeen);
router.post("/api/repository-digests/ingest", assistantRouterHandlers.handleIngestRepositories);

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
