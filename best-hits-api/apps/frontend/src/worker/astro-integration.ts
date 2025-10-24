// Integration file to combine Astro frontend with our existing API routes
import { Router } from "itty-router";
import { createAgentHandler } from "@cloudflare/agent";
import { assistantRouterHandlers } from "./routers/assistant-router";
import { handleListTemplates } from "./routers/template-router";
import { withApiKey } from "./utils/with-api-key";

export interface Env {
  WORKER_API_KEY: string;
  API_TOKEN: string;
  DB: D1Database;
  KV_CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
}

// Import the Astro worker
let astroWorker: any = null;

async function getAstroWorker() {
  if (!astroWorker) {
    // Dynamically import the Astro worker
    const astroModule = await import("../dist/_worker.js/index.js");
    astroWorker = astroModule.default;
  }
  return astroWorker;
}

const router = Router();

// API routes that should be handled by our existing logic
router.all("/api/threads", assistantRouterHandlers.handleListThreads);
router.get("/api/threads/:id/messages", assistantRouterHandlers.handleListMessages);
router.post("/api/threads", assistantRouterHandlers.handleSubmitPrompt);
router.post("/api/assistant-prompts/sync", assistantRouterHandlers.handleSyncPrompts);
router.post("/api/assistant-prompts/mark-modified", assistantRouterHandlers.handleMarkModified);
router.post("/api/assistant-prompts/mark-last-seen", assistantRouterHandlers.handleMarkLastSeen);
router.post("/api/repository-digests/ingest", assistantRouterHandlers.handleIngestRepositories);
router.post("/agent/query", createAgentHandler);

// Templates API (keep existing)
router.get("/api/templates", handleListTemplates);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle our custom API routes first
    if (url.pathname.startsWith("/api/threads") || 
        url.pathname.startsWith("/api/assistant-prompts") ||
        url.pathname.startsWith("/api/repository-digests") ||
        url.pathname.startsWith("/agent/query") ||
        url.pathname === "/api/templates") {
      return router.handle(request, env, ctx);
    }
    
    // For all other routes, delegate to the Astro worker
    const astroWorker = await getAstroWorker();
    return astroWorker.fetch(request, env, ctx);
  }
};