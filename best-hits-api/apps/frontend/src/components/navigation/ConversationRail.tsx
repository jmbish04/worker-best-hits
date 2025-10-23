import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { cn } from "../../lib/utils";
import { fetchThreads } from "../../lib/api";

export interface ConversationRailProps {
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

export function ConversationRail({ activeThreadId, onSelectThread }: ConversationRailProps) {
  const { data } = useQuery({ queryKey: ["threads"], queryFn: fetchThreads });

  return (
    <nav className="rail">
      <header>
        <h2>Agent Threads</h2>
        <p className="subtitle">Continue previous explorations or start fresh.</p>
      </header>
      <ScrollArea className="rail-scroll">
        <ul>
          {(data ?? []).map((thread) => (
            <li key={thread.id}>
              <button
                className={cn("rail-button", activeThreadId === thread.id && "active")}
                onClick={() => onSelectThread(thread.id)}
              >
                <span className="title">{thread.title}</span>
                <span className="meta">{thread.updatedAt}</span>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </nav>
  );
}
