import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { IntegrationContext, IntegrationModule } from "../../server/integrations/registry.js";

const INTEGRATION_NAME = "slack";
const SLACK_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "im:read",
  "im:history",
  "chat:write",
  "search:read",
  "users:read",
];

async function getToken(ctx: IntegrationContext): Promise<string | null> {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN;
  if (process.env.SLACK_USER_TOKEN) return process.env.SLACK_USER_TOKEN;
  const conn = await ctx.getConnection("slack");
  return conn?.accessToken ?? null;
}

async function slack<T = any>(
  token: string,
  method: string,
  params: Record<string, any> = {},
  httpMethod: "GET" | "POST" = "POST",
): Promise<T> {
  const url = `https://slack.com/api/${method}`;
  let res: Response;
  if (httpMethod === "GET") {
    const q = new URLSearchParams(params as any).toString();
    res = await fetch(`${url}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  } else {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(params),
    });
  }
  const json = (await res.json()) as any;
  if (!json.ok) throw new Error(`slack ${method}: ${json.error}`);
  return json as T;
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
          "Slack is not connected. Add SLACK_BOT_TOKEN / SLACK_USER_TOKEN, or connect via OAuth in the debug dashboard.",
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
        "Search Slack messages across channels the token can see. Use short phrases.",
        { query: z.string(), count: z.number().optional().default(15) },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const data = await slack<any>(token, "search.messages", {
              query: args.query,
              count: args.count,
            });
            const matches = data.messages?.matches ?? [];
            const body = matches
              .map(
                (m: any) =>
                  `• [${m.channel?.name}] ${new Date(
                    Number(m.ts) * 1000,
                  ).toLocaleString()} — ${m.username ?? m.user}: ${m.text}`,
              )
              .join("\n");
            return {
              content: [{ type: "text" as const, text: body || "No matches." }],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "list_channels",
        "List channels the token can access.",
        { limit: z.number().optional().default(50) },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const data = await slack<any>(
              token,
              "conversations.list",
              { types: "public_channel,private_channel", limit: args.limit },
              "GET",
            );
            const body = (data.channels ?? [])
              .map((c: any) => `• #${c.name} (${c.id})`)
              .join("\n");
            return { content: [{ type: "text" as const, text: body || "(none)" }] };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "channel_history",
        "Recent messages in a channel.",
        { channelId: z.string(), limit: z.number().optional().default(20) },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const data = await slack<any>(
              token,
              "conversations.history",
              { channel: args.channelId, limit: args.limit },
              "GET",
            );
            const body = (data.messages ?? [])
              .reverse()
              .map(
                (m: any) =>
                  `${new Date(Number(m.ts) * 1000).toLocaleString()} — ${m.user}: ${m.text}`,
              )
              .join("\n");
            return { content: [{ type: "text" as const, text: body || "(empty)" }] };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "send_message",
        "Send a Slack message. DO NOT call directly — use save_draft from boop-drafts. Only reachable when send_draft approves.",
        {
          channelId: z.string(),
          text: z.string(),
          threadTs: z.string().optional(),
        },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const data = await slack<any>(token, "chat.postMessage", {
              channel: args.channelId,
              text: args.text,
              thread_ts: args.threadTs,
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Sent. ts=${data.ts} channel=${data.channel}`,
                },
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
  description: "Slack: search, read, send (via drafts).",
  requiredEnv: ["SLACK_BOT_TOKEN"],
  createServer: async (ctx) => build(ctx),
};

export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  opts.registerIntegration(mod);
}

export const SLACK_OAUTH_SCOPES = SLACK_SCOPES;
