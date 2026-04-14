import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

export function DraftsPanel() {
  const drafts = useQuery(api.drafts.recent, { limit: 100 });

  return (
    <div className="panel">
      <h2>Drafts</h2>
      {!drafts ? (
        <div className="empty">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="empty">No drafts yet. When the agent stages an external action, it shows up here.</div>
      ) : (
        drafts.map((d) => (
          <div key={d._id} className="row">
            <div className="meta">
              <span className={`status-badge ${d.status === "pending" ? "running" : d.status === "sent" ? "completed" : "cancelled"}`}>
                {d.status}
              </span>
              <span>{d.kind}</span>
              <span>{d.conversationId}</span>
              <span>{new Date(d.createdAt).toLocaleString()}</span>
            </div>
            <div className="body">{d.summary}</div>
            <details>
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem" }}>
                payload
              </summary>
              <pre style={{ fontSize: "0.75rem", marginTop: "0.4rem", whiteSpace: "pre-wrap" }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(d.payload), null, 2);
                  } catch {
                    return d.payload;
                  }
                })()}
              </pre>
            </details>
          </div>
        ))
      )}
    </div>
  );
}
