import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

type Tier = "short" | "long" | "permanent";

export function MemoryPanel() {
  const [tier, setTier] = useState<Tier | "all">("all");
  const counts = useQuery(api.memoryRecords.countsByTier, {});
  const memories = useQuery(api.memoryRecords.list, {
    tier: tier === "all" ? undefined : tier,
    lifecycle: "active",
    limit: 100,
  });

  return (
    <>
      <div className="panel">
        <h2>Memory tiers</h2>
        <div className="grid">
          <Stat label="Short" value={counts?.short ?? 0} cls="tier-short" />
          <Stat label="Long" value={counts?.long ?? 0} cls="tier-long" />
          <Stat label="Permanent" value={counts?.permanent ?? 0} cls="tier-permanent" />
          <Stat label="Archived" value={counts?.archived ?? 0} />
          <Stat label="Pruned" value={counts?.pruned ?? 0} />
        </div>
      </div>

      <div className="panel">
        <h2>
          Active memories
          <select
            style={{ marginLeft: "1rem" }}
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier | "all")}
          >
            <option value="all">All tiers</option>
            <option value="short">Short</option>
            <option value="long">Long</option>
            <option value="permanent">Permanent</option>
          </select>
        </h2>
        {!memories ? (
          <div className="empty">Loading…</div>
        ) : memories.length === 0 ? (
          <div className="empty">No memories yet.</div>
        ) : (
          memories.map((m) => (
            <div key={m._id} className="row">
              <div className="meta">
                <span className={`tier-${m.tier}`}>{m.tier}</span>
                <span>{m.segment}</span>
                <span>importance {m.importance.toFixed(2)}</span>
                <span>access × {m.accessCount}</span>
                <span>{new Date(m.lastAccessedAt).toLocaleDateString()}</span>
              </div>
              <div className="body">{m.content}</div>
              <div className="meta">
                <code>{m.memoryId}</code>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${cls ?? ""}`}>{value}</div>
    </div>
  );
}
