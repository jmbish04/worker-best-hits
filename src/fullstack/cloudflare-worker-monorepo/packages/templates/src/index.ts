import type { TemplateIndex } from "../../apps/frontend/src/lib/types";

export type TemplatesEnv = Record<string, unknown>;

const catalog: TemplateIndex = {
  "Backend Workers": {
    description: "Durable Object, queue consumers, and API gateway patterns.",
    items: [
      {
        slug: "durable-object-chat",
        title: "Durable Object Chat Session",
        summary: "Stateful agent conversation powered by Durable Objects.",
        tag: "durable-object",
        sourceUrl: "https://github.com/example/durable-object-chat"
      },
      {
        slug: "secure-api-gateway",
        title: "Secure API Gateway",
        summary: "Env-key protected API router with audit logging hooks.",
        tag: "api",
        sourceUrl: "https://github.com/example/secure-api"
      }
    ]
  },
  "Frontend Components": {
    description: "Shadcn UI compositions tailored for worker developer workflows.",
    items: [
      {
        slug: "thread-rail",
        title: "Thread Navigation Rail",
        summary: "Persistent left rail with search and thread filtering.",
        tag: "ui",
        sourceUrl: "https://github.com/example/thread-rail"
      },
      {
        slug: "agent-chat-panel",
        title: "Agent Chat Panel",
        summary: "Responsive chat layout with streaming responses and tool call viz.",
        tag: "chat",
        sourceUrl: "https://github.com/example/chat-panel"
      }
    ]
  },
  "AI Patterns": {
    description: "RAG, orchestration, and evaluation recipes for Cloudflare Workers.",
    items: [
      {
        slug: "repo-rag",
        title: "Repository RAG",
        summary: "Retrieve GitHub code and docs to enrich worker planning.",
        tag: "rag",
        sourceUrl: "https://github.com/example/repo-rag"
      },
      {
        slug: "agent-evals",
        title: "Agent Evaluation Harness",
        summary: "Benchmark worker agents across user journeys and GitHub tasks.",
        tag: "evaluation",
        sourceUrl: "https://github.com/example/agent-evals"
      }
    ]
  },
  "Full-Stack Templates": {
    description: "End-to-end worker + React setups derived from best-hits library.",
    items: [
      {
        slug: "workflow-studio",
        title: "Workflow Studio",
        summary: "Opinionated workspace for prototyping automation workers.",
        tag: "full-stack",
        sourceUrl: "https://github.com/example/workflow-studio"
      }
    ]
  }
};

export function createTemplateLibrary() {
  return {
    async list(_env: TemplatesEnv) {
      return catalog;
    }
  };
}
