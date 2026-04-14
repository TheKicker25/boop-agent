import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

export function AgentsPanel() {
  const agents = useQuery(api.agents.list, { limit: 30 });
  const [selected, setSelected] = useState<string | null>(null);
  const logs = useQuery(
    api.agents.getLogs,
    selected ? { agentId: selected, limit: 500 } : "skip",
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 2fr", gap: "1rem" }}>
      <div className="panel">
        <h2>Recent agents</h2>
        {!agents ? (
          <div className="empty">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="empty">No agents spawned yet.</div>
        ) : (
          agents.map((a) => (
            <div
              key={a._id}
              className="row"
              onClick={() => setSelected(a.agentId)}
              style={{ cursor: "pointer", outline: selected === a.agentId ? "1px solid var(--accent)" : "none" }}
            >
              <div className="meta">
                <span className={`status-badge ${a.status}`}>{a.status}</span>
                <span>{a.name}</span>
                <span>{new Date(a.startedAt).toLocaleTimeString()}</span>
                <span>tok {a.inputTokens}/{a.outputTokens}</span>
              </div>
              <div className="body">{a.task}</div>
              <div className="meta">
                <span>tools: {a.mcpServers.join(", ") || "(none)"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h2>Logs {selected ? <code>{selected}</code> : ""}</h2>
        {!selected ? (
          <div className="empty">Pick an agent on the left.</div>
        ) : !logs ? (
          <div className="empty">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="empty">No logs for this agent.</div>
        ) : (
          logs.map((l) => (
            <div key={l._id} className="row">
              <div className="meta">
                <span className="event-type">{l.logType}</span>
                {l.toolName && <span>{l.toolName}</span>}
                <span>{new Date(l.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="body">{l.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
