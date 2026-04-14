import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

export function AutomationsPanel() {
  const automations = useQuery(api.automations.list, {});
  const [selected, setSelected] = useState<string | null>(null);
  const runs = useQuery(
    api.automations.recentRuns,
    selected ? { automationId: selected, limit: 25 } : "skip",
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 2fr", gap: "1rem" }}>
      <div className="panel">
        <h2>Automations</h2>
        {!automations ? (
          <div className="empty">Loading…</div>
        ) : automations.length === 0 ? (
          <div className="empty">
            None yet. Text the agent something like <em>"every morning at 8 summarize my calendar"</em>.
          </div>
        ) : (
          automations.map((a) => (
            <div
              key={a._id}
              className="row"
              onClick={() => setSelected(a.automationId)}
              style={{
                cursor: "pointer",
                outline: selected === a.automationId ? "1px solid var(--accent)" : "none",
                opacity: a.enabled ? 1 : 0.5,
              }}
            >
              <div className="meta">
                <span className={`status-badge ${a.enabled ? "running" : "cancelled"}`}>
                  {a.enabled ? "enabled" : "paused"}
                </span>
                <span>{a.name}</span>
                <span>
                  <code>{a.schedule}</code>
                </span>
              </div>
              <div className="body">{a.task}</div>
              <div className="meta">
                <span>integrations: {a.integrations.join(", ") || "(none)"}</span>
                {a.nextRunAt && <span>next: {new Date(a.nextRunAt).toLocaleString()}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h2>Recent runs {selected ? <code>{selected}</code> : ""}</h2>
        {!selected ? (
          <div className="empty">Pick an automation on the left.</div>
        ) : !runs ? (
          <div className="empty">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="empty">No runs yet.</div>
        ) : (
          runs.map((r) => (
            <div key={r._id} className="row">
              <div className="meta">
                <span className={`status-badge ${r.status}`}>{r.status}</span>
                <span>{new Date(r.startedAt).toLocaleString()}</span>
                {r.agentId && <span>agent: {r.agentId}</span>}
              </div>
              {r.result && <div className="body">{r.result}</div>}
              {r.error && <div className="body" style={{ color: "var(--err)" }}>{r.error}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
