import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

const CONVERSATION_ID = "debug:local";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messages = useQuery(api.messages.recent, { conversationId: CONVERSATION_ID, limit: 50 });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: CONVERSATION_ID, content: input }),
      });
      setInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <h2>Local chat</h2>
      <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "0.5rem 0" }}>
        {!messages || messages.length === 0 ? (
          <div className="empty">No messages yet. Say hi.</div>
        ) : (
          messages.map((m) => (
            <div key={m._id} className="row">
              <div className="meta">
                <span>{m.role}</span>
                <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="body">{m.content}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <input
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Text your agent…"
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="active"
          style={{ padding: "0.4rem 1rem" }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
