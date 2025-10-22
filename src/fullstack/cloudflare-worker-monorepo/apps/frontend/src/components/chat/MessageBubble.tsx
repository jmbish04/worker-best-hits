import type { Message } from "../../lib/types";

export interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAgent = message.role === "assistant";

  return (
    <article className={`bubble ${isAgent ? "agent" : "user"}`}>
      <header>
        <span className="role">{isAgent ? "Agent" : "You"}</span>
        <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
      </header>
      <p>{message.content}</p>
    </article>
  );
}
