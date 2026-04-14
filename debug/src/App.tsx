import { useEffect, useState } from "react";
import { AgentsPanel } from "./components/AgentsPanel.js";
import { MemoryPanel } from "./components/MemoryPanel.js";
import { EventsPanel } from "./components/EventsPanel.js";
import { ChatPanel } from "./components/ChatPanel.js";
import { AutomationsPanel } from "./components/AutomationsPanel.js";
import { DraftsPanel } from "./components/DraftsPanel.js";
import { ConnectionsPanel } from "./components/ConnectionsPanel.js";
import { useSocket } from "./lib/useSocket.js";

type Tab =
  | "chat"
  | "agents"
  | "automations"
  | "drafts"
  | "memory"
  | "events"
  | "connections";

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const { connected } = useSocket();
  const [title, setTitle] = useState("boop-agent");

  useEffect(() => {
    setTitle(`boop-agent · ${tab}`);
    document.title = title;
  }, [tab, title]);

  return (
    <div className="app">
      <nav className="nav">
        <h1>boop-agent</h1>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          Chat
        </button>
        <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>
          Agents
        </button>
        <button className={tab === "automations" ? "active" : ""} onClick={() => setTab("automations")}>
          Automations
        </button>
        <button className={tab === "drafts" ? "active" : ""} onClick={() => setTab("drafts")}>
          Drafts
        </button>
        <button className={tab === "memory" ? "active" : ""} onClick={() => setTab("memory")}>
          Memory
        </button>
        <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>
          Events
        </button>
        <button className={tab === "connections" ? "active" : ""} onClick={() => setTab("connections")}>
          Connections
        </button>
        <div className="spacer" />
        <span className={`status ${connected ? "ok" : ""}`}>
          <span className="dot" />
          {connected ? "connected" : "disconnected"}
        </span>
      </nav>
      <main>
        {tab === "chat" && <ChatPanel />}
        {tab === "agents" && <AgentsPanel />}
        {tab === "automations" && <AutomationsPanel />}
        {tab === "drafts" && <DraftsPanel />}
        {tab === "memory" && <MemoryPanel />}
        {tab === "events" && <EventsPanel />}
        {tab === "connections" && <ConnectionsPanel />}
      </main>
    </div>
  );
}
