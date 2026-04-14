import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { IntegrationContext, IntegrationModule } from "../../server/integrations/registry.js";

const INTEGRATION_NAME = "google-calendar";

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

  const conn = await ctx.getConnection("google-calendar");
  return conn?.accessToken ?? null;
}

async function gcal<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `https://www.googleapis.com/calendar/v3${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`google-calendar ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function errText(err: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }] };
}

function authError(): { content: [{ type: "text"; text: string }] } {
  return {
    content: [
      {
        type: "text" as const,
        text:
          "Google Calendar is not connected. Add GOOGLE_REFRESH_TOKEN (+ GOOGLE_CLIENT_ID/SECRET) to .env.local, or create a connection via the debug dashboard.",
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
        "list_events",
        "List upcoming events on the user's primary calendar. Use this before answering anything about the user's schedule.",
        {
          timeMin: z.string().optional().describe("ISO 8601. Defaults to now."),
          timeMax: z.string().optional().describe("ISO 8601. Defaults to 7 days from now."),
          maxResults: z.number().optional().default(25),
          q: z.string().optional().describe("Text search across event fields."),
        },
        async (args) => {
          try {
            const token = await getAccessToken(ctx);
            if (!token) return authError();
            const now = new Date();
            const params = new URLSearchParams({
              singleEvents: "true",
              orderBy: "startTime",
              timeMin: args.timeMin ?? now.toISOString(),
              timeMax:
                args.timeMax ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              maxResults: String(args.maxResults ?? 25),
            });
            if (args.q) params.set("q", args.q);
            const data = await gcal<{ items: any[] }>(
              token,
              `/calendars/primary/events?${params}`,
            );
            const body = (data.items ?? [])
              .map((e) => {
                const start = e.start?.dateTime ?? e.start?.date ?? "?";
                return `• ${start} — ${e.summary ?? "(no title)"}${e.location ? ` @ ${e.location}` : ""} [${e.id}]`;
              })
              .join("\n");
            return {
              content: [
                { type: "text" as const, text: body || "No events in that window." },
              ],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "get_event",
        "Get full details for a single event by ID.",
        { eventId: z.string() },
        async (args) => {
          try {
            const token = await getAccessToken(ctx);
            if (!token) return authError();
            const e = await gcal<any>(token, `/calendars/primary/events/${args.eventId}`);
            return {
              content: [{ type: "text" as const, text: JSON.stringify(e, null, 2) }],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "create_event",
        "Create a new event on the primary calendar. IMPORTANT: this takes an external action. Draft it first and ask the user to confirm before calling this tool for real.",
        {
          summary: z.string(),
          start: z.string().describe("ISO 8601."),
          end: z.string().describe("ISO 8601."),
          description: z.string().optional(),
          location: z.string().optional(),
          attendees: z.array(z.string()).optional().describe("Emails."),
        },
        async (args) => {
          try {
            const token = await getAccessToken(ctx);
            if (!token) return authError();
            const body = {
              summary: args.summary,
              description: args.description,
              location: args.location,
              start: { dateTime: args.start },
              end: { dateTime: args.end },
              attendees: args.attendees?.map((email) => ({ email })),
            };
            const created = await gcal<any>(token, `/calendars/primary/events`, {
              method: "POST",
              body: JSON.stringify(body),
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Created event ${created.id}: ${created.summary} (${created.htmlLink})`,
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
  description: "Google Calendar: read the schedule, create events.",
  requiredEnv: ["GOOGLE_REFRESH_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  createServer: async (ctx) => build(ctx),
};

export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  opts.registerIntegration(mod);
}
