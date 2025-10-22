export type MessageRole = "user" | "ai";

export interface DatabaseMessage {
  id: number;
  user_id: string;
  message: string;
  role: MessageRole;
  created_at: string;
  summary?: string;
}

// Context interface
export interface LLMPContext {
  userId: string;
}