import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

export function EventsPanel() {
  const events = useQuery(api.memoryEvents.recent, { limit: 150 });

  return (
    <div className="panel">
      <h2>Recent events</h2>
      {!events ? (
        <div className="empty">Loading…</div>
      ) : events.length === 0 ? (
        <div className="empty">No events yet.</div>
      ) : (
        events.map((e) => (
          <div key={e._id} className="row">
            <div className="meta">
              <span className="event-type">{e.eventType}</span>
              {e.conversationId && <span>{e.conversationId}</span>}
              {e.memoryId && <span>mem:{e.memoryId}</span>}
              {e.agentId && <span>agent:{e.agentId}</span>}
              <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="body">{e.data}</div>
          </div>
        ))
      )}
    </div>
  );
}
