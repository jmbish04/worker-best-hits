import { Router } from "itty-router";
import { createAgentHandler } from "@cloudflare/agent";
import { createAssistantRouter } from "./routers/assistant-router";
import { createTemplateRouter } from "./routers/template-router";
import { withApiKey } from "./utils/with-api-key";

export interface Env {
  WORKER_API_KEY: string;
  D1: D1Database;
  KV_CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  AI: Ai;
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

router.all("*", () => new Response("Not Found", { status: 404 }));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  }
};
