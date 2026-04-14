import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { IntegrationContext, IntegrationModule } from "../../server/integrations/registry.js";

const INTEGRATION_NAME = "gmail";
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

async function getAccessToken(ctx: IntegrationContext): Promise<string | null> {
  const direct = process.env.GOOGLE_ACCESS_TOKEN;
  if (direct) return direct;

  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (refresh && clientId && clientSecret) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { access_token: string };
      return json.access_token;
    }
  }

  const conn = await ctx.getConnection("gmail");
  return conn?.accessToken ?? null;
}

async function gmail<T = any>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`gmail ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function decodeBody(part: any): string {
  if (!part) return "";
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  if (part.parts) {
    const plain = part.parts.find((p: any) => p.mimeType === "text/plain");
    if (plain) return decodeBody(plain);
    const html = part.parts.find((p: any) => p.mimeType === "text/html");
    if (html) return decodeBody(html);
    return part.parts.map(decodeBody).join("\n");
  }
  return "";
}

function header(headers: any[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function rfc2822(to: string, subject: string, body: string, from?: string): string {
  const lines = [
    from ? `From: ${from}` : "",
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].filter(Boolean);
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function errText(err: unknown) {
  return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }] };
}

function authError() {
  return {
    content: [
      {
        type: "text" as const,
        text:
          "Gmail is not connected. Add GOOGLE_REFRESH_TOKEN or connect via OAuth in the debug dashboard.",
      },
    ],
  };
}

function build(ctx: IntegrationContext) {
  return createSdkMcpServer({
    name: INTEGRATION_NAME,
    version: "0.1.0",
    tools: [
      tool(
        "search",
        "Search Gmail. Use Gmail's search syntax (from:, subject:, newer_than:, etc.). Returns a list of message summaries with IDs.",
        { query: z.string(), maxResults: z.number().optional().default(15) },
        async (args) => {
          try {
            const token = await getAccessToken(ctx);
            if (!token) return authError();
            const list = await gmail<{ messages?: { id: string }[] }>(
              token,
              `/users/me/messages?q=${encodeURIComponent(args.query)}&maxResults=${args.maxResults}`,
            );
            const ids = (list.messages ?? []).slice(0, args.maxResults);
            const summaries = await Promise.all(
              ids.map(async (m) => {
                const full = await gmail<any>(
                  token,
                  `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                );
                const h = full.payload?.headers ?? [];
                return `• [${m.id}] ${header(h, "Date")} — ${header(h, "From")} — ${header(h, "Subject")}`;
              }),
            );
            return {
              content: [
                { type: "text" as const, text: summaries.join("\n") || "No matches." },
              ],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "get_message",
        "Get full body of a Gmail message by ID.",
        { messageId: z.string() },
        async (args) => {
          try {
            const token = await getAccessToken(ctx);
            if (!token) return authError();
            const msg = await gmail<any>(
              token,
              `/users/me/messages/${args.messageId}?format=full`,
            );
            const h = msg.payload?.headers ?? [];
            const body = decodeBody(msg.payload);
            const out = `From: ${header(h, "From")}
Date: ${header(h, "Date")}
Subject: ${header(h, "Subject")}

${body}`.slice(0, 8000);
            return { content: [{ type: "text" as const, text: out }] };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "send_email",
        "Actually send an email. DO NOT call this directly — use save_draft from boop-drafts instead so the user can review. Only reachable when the interaction agent's send_draft triggers you.",
        {
          to: z.string(),
          subject: z.string(),
          body: z.string(),
          threadId: z.string().optional(),
        },
        async (args) => {
          try {
            const token = await getAccessToken(ctx);
            if (!token) return authError();
            const raw = rfc2822(args.to, args.subject, args.body);
            const sent = await gmail<any>(token, `/users/me/messages/send`, {
              method: "POST",
              body: JSON.stringify({ raw, threadId: args.threadId }),
            });
            return {
              content: [
                { type: "text" as const, text: `Sent. Message id: ${sent.id}` },
              ],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),
    ],
  });
}

const mod: IntegrationModule = {
  name: INTEGRATION_NAME,
  description: "Gmail: search, read, send (via drafts).",
  requiredEnv: ["GOOGLE_REFRESH_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  createServer: async (ctx) => build(ctx),
};

export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  opts.registerIntegration(mod);
}

export const GMAIL_OAUTH_SCOPES = GMAIL_SCOPES;
