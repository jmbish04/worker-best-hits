import { useState } from "react";
import { ConversationRail } from "./components/navigation/ConversationRail";
import { ChatPanel } from "./components/chat/ChatPanel";
import { ResourceExplorer } from "./components/navigation/ResourceExplorer";
import { useTemplates } from "./lib/useTemplates";

export default function App() {
  const templates = useTemplates();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  return (
    <div className="app-grid">
      <ConversationRail
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
      />
      <main className="chat-area">
        <ChatPanel
          activeThreadId={activeThreadId}
          onThreadCreated={setActiveThreadId}
        />
      </main>
      <aside className="resource-area">
        <ResourceExplorer templates={templates} />
      </aside>
    </div>
  );
}
