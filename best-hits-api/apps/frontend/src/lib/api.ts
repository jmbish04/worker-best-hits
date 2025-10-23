import type { Message, TemplateIndex, Thread } from "./types";

const API_BASE = (globalThis as any).__WORKER_API_BASE__ ?? "https://worker.example.com";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchThreads(): Promise<Thread[]> {
  return request("/api/threads");
}

export function fetchMessages(threadId: string): Promise<Message[]> {
  return request(`/api/threads/${threadId}/messages`);
}

export function postMessage(prompt: string, threadId: string | null) {
  return request<{ threadId: string }>(`/api/threads`, {
    method: "POST",
    body: JSON.stringify({ prompt, threadId })
  });
}

export function fetchTemplates(): Promise<TemplateIndex> {
  return request("/api/templates");
}
