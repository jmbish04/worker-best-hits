import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { SendHorizonal } from "lucide-react";
import { fetchMessages, postMessage } from "../../lib/api";
import { MessageBubble } from "./MessageBubble";
import { useForm } from "../../lib/useForm";

export interface ChatPanelProps {
  activeThreadId: string | null;
  onThreadCreated: (threadId: string) => void;
}

export function ChatPanel({ activeThreadId, onThreadCreated }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const { values, handleChange, reset } = useForm({ prompt: "" });
  const endRef = useRef<HTMLDivElement | null>(null);

  const { data } = useQuery({
    queryKey: ["messages", activeThreadId],
    enabled: Boolean(activeThreadId),
    queryFn: () => fetchMessages(activeThreadId!)
  });

  const mutation = useMutation({
    mutationFn: () => postMessage(values.prompt, activeThreadId),
    onSuccess: (result) => {
      reset();
      if (!activeThreadId && result.threadId) {
        onThreadCreated(result.threadId);
      }
      queryClient.invalidateQueries({ queryKey: ["messages", result.threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data]);

  return (
    <div className="chat-panel">
      <header className="chat-header">
        <div>
          <h2>Cloudflare Agent Assistant</h2>
          <p className="subtitle">
            Ask the agent to scaffold workers, refactor templates, or summarize repos.
          </p>
        </div>
      </header>

      <section className="chat-messages">
        {(data ?? []).map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </section>

      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <textarea
          name="prompt"
          placeholder="Describe the worker you need or ask for repo insights..."
          value={values.prompt}
          onChange={handleChange}
          rows={4}
          required
        />
        <button type="submit" className="send-button" disabled={mutation.isPending}>
          <SendHorizonal size={20} />
          Send
        </button>
      </form>
    </div>
  );
}
