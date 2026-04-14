import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { IntegrationContext, IntegrationModule } from "../../server/integrations/registry.js";

const INTEGRATION_NAME = "notion";
const NOTION_VERSION = "2022-06-28";

async function getToken(ctx: IntegrationContext): Promise<string | null> {
  if (process.env.NOTION_TOKEN) return process.env.NOTION_TOKEN;
  const conn = await ctx.getConnection("notion");
  return conn?.accessToken ?? null;
}

async function notion<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`notion ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
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
          "Notion is not connected. Add NOTION_TOKEN to .env.local (create an internal integration at https://www.notion.so/profile/integrations and share a page with it).",
      },
    ],
  };
}

function summarizePage(p: any): string {
  const title =
    p.properties?.title?.title?.[0]?.plain_text ??
    p.properties?.Name?.title?.[0]?.plain_text ??
    p.child_page?.title ??
    "(untitled)";
  return `• ${title}  [${p.id}]  ${p.url ?? ""}`.trim();
}

function build(ctx: IntegrationContext) {
  return createSdkMcpServer({
    name: INTEGRATION_NAME,
    version: "0.1.0",
    tools: [
      tool(
        "search",
        "Search pages and databases shared with the Notion integration. Use short, specific queries.",
        { query: z.string(), pageSize: z.number().optional().default(10) },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const data = await notion<{ results: any[] }>(token, "/search", {
              method: "POST",
              body: JSON.stringify({ query: args.query, page_size: args.pageSize }),
            });
            const body = (data.results ?? []).map(summarizePage).join("\n");
            return {
              content: [{ type: "text" as const, text: body || "No matches." }],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "get_page",
        "Fetch a page's properties + block children by page ID.",
        { pageId: z.string() },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const page = await notion<any>(token, `/pages/${args.pageId}`);
            const blocks = await notion<{ results: any[] }>(
              token,
              `/blocks/${args.pageId}/children?page_size=50`,
            );
            const text = blocks.results
              .map((b) => {
                const rich = b[b.type]?.rich_text ?? [];
                return rich.map((r: any) => r.plain_text).join("");
              })
              .filter(Boolean)
              .join("\n");
            return {
              content: [
                {
                  type: "text" as const,
                  text: `${summarizePage(page)}\n\n${text}`.slice(0, 8000),
                },
              ],
            };
          } catch (err) {
            return errText(err);
          }
        },
      ),

      tool(
        "create_page",
        "Create a new page inside a parent page or database. IMPORTANT: external action — draft first and confirm before calling.",
        {
          parentId: z.string().describe("Page or database ID to create this page under."),
          parentType: z.enum(["page", "database"]),
          title: z.string(),
          body: z.string().optional().describe("Plain text body; creates paragraph blocks."),
        },
        async (args) => {
          try {
            const token = await getToken(ctx);
            if (!token) return authError();
            const parent =
              args.parentType === "page"
                ? { page_id: args.parentId }
                : { database_id: args.parentId };
            const properties =
              args.parentType === "page"
                ? { title: [{ text: { content: args.title } }] }
                : { Name: { title: [{ text: { content: args.title } }] } };
            const children = args.body
              ? args.body.split(/\n{2,}/).map((para) => ({
                  object: "block",
                  type: "paragraph",
                  paragraph: { rich_text: [{ type: "text", text: { content: para } }] },
                }))
              : undefined;
            const created = await notion<any>(token, "/pages", {
              method: "POST",
              body: JSON.stringify({ parent, properties, children }),
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Created page ${created.id}: ${created.url}`,
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
  description: "Notion: search, read, and create pages.",
  requiredEnv: ["NOTION_TOKEN"],
  createServer: async (ctx) => build(ctx),
};

export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  opts.registerIntegration(mod);
}
