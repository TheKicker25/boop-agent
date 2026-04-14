import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

interface Provider {
  name: string;
  configured: boolean;
  scopes: string[];
  redirectUri: string;
}

export function ConnectionsPanel() {
  const connections = useQuery(api.connections.list, {});
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    fetch("/api/oauth/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  return (
    <>
      <div className="panel">
        <h2>Connect a provider</h2>
        {providers.length === 0 ? (
          <div className="empty">Loading…</div>
        ) : (
          providers.map((p) => (
            <div key={p.name} className="row">
              <div className="meta">
                <span
                  className={`status-badge ${p.configured ? "completed" : "cancelled"}`}
                >
                  {p.configured ? "configured" : "not configured"}
                </span>
                <span>{p.name}</span>
              </div>
              <div className="body">
                Redirect URI: <code>{p.redirectUri}</code>
                <br />
                Scopes: <code>{p.scopes.join(" ")}</code>
              </div>
              <div>
                {p.configured ? (
                  <a
                    href={`/api/oauth/${p.name}/start`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      padding: "0.3rem 0.7rem",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      color: "var(--accent)",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                    }}
                  >
                    Connect {p.name}
                  </a>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    Add CLIENT_ID + CLIENT_SECRET to .env.local, restart the server.
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h2>Active connections</h2>
        {!connections ? (
          <div className="empty">Loading…</div>
        ) : connections.length === 0 ? (
          <div className="empty">No OAuth connections yet.</div>
        ) : (
          connections.map((c) => (
            <div key={c._id} className="row">
              <div className="meta">
                <span className={`status-badge ${c.status === "active" ? "completed" : "cancelled"}`}>
                  {c.status}
                </span>
                <span>{c.service}</span>
                {c.accountLabel && <span>{c.accountLabel}</span>}
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="meta">
                <code>{c.connectionId}</code>
                {c.tokenExpiresAt && (
                  <span>
                    expires {new Date(c.tokenExpiresAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
