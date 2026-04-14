# Adding integrations

An integration is a folder in `/integrations/` that exposes tools to the execution agent. Under the hood, each integration is an MCP server built with `createSdkMcpServer` from `@anthropic-ai/claude-agent-sdk`.

The four examples — `google-calendar/`, `gmail/`, `notion/`, `slack/` — are intentionally small (~150 lines each). Read them first.

---

## Five-minute version

```bash
cp -r integrations/_template integrations/weather
```

Edit `integrations/weather/index.ts`:

```ts
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { IntegrationContext, IntegrationModule } from "../../server/integrations/registry.js";

const INTEGRATION_NAME = "weather";

function build(_ctx: IntegrationContext) {
  return createSdkMcpServer({
    name: INTEGRATION_NAME,
    version: "0.1.0",
    tools: [
      tool(
        "get_forecast",
        "Get a 3-day forecast for a city. Returns high/low + conditions per day.",
        { city: z.string() },
        async (args) => {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(args.city)}?format=j1`);
          const json = await res.json();
          const text = json.weather
            .slice(0, 3)
            .map((d: any) => `${d.date}: ${d.mintempF}→${d.maxtempF}°F, ${d.hourly[4].weatherDesc[0].value}`)
            .join("\n");
          return { content: [{ type: "text" as const, text }] };
        },
      ),
    ],
  });
}

const mod: IntegrationModule = {
  name: INTEGRATION_NAME,
  description: "3-day forecast for any city.",
  requiredEnv: [],
  createServer: async (ctx) => build(ctx),
};

export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  opts.registerIntegration(mod);
}
```

Open `server/integrations/registry.ts` and add your import to `loaders`:

```ts
const loaders = [
  import("../../integrations/google-calendar/index.js"),
  import("../../integrations/notion/index.js"),
  import("../../integrations/weather/index.js"),   // ← add this
];
```

Restart the server. The next time the agent decides to spawn, it'll see `weather` in the integration list.

---

## The integration contract

Every integration module exports two things:

```ts
// 1. A module object describing the integration.
const mod: IntegrationModule = {
  name: "weather",                     // how spawn_agent references you
  description: "3-day forecast…",      // shown to the dispatcher
  requiredEnv: ["WEATHER_API_KEY"],    // documentation only
  createServer: async (ctx) => build(ctx),
};

// 2. A register() fn called at server startup.
export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  opts.registerIntegration(mod);
}
```

`ctx: IntegrationContext` gives you:

- `ctx.conversationId` — the current conversation, if any.
- `ctx.getConnection(service)` — fetches an OAuth record from Convex `connections` table (returns `{ accessToken, refreshToken?, metadata? }` or `null`).

---

## Writing good tool descriptions

The model reads every tool description to decide what to call. Treat them like specs.

**Bad:**
```
"Get events."
```

**Good:**
```
"List upcoming events on the user's primary calendar. Use this before answering anything about the user's schedule. Returns ISO start times, titles, locations, and event IDs. Defaults to the next 7 days."
```

Rules of thumb:

- Say **when** to call it ("before answering about X"), not just what it does.
- Say what it returns. The model plans around return shapes.
- Call out gotchas ("remember to draft first before create_event").
- Keep it under ~200 words per tool. Long descriptions bloat the interaction agent's token cost.

---

## Auth patterns

### Static token (simplest)

Best for personal use.

```ts
const token = process.env.MY_API_TOKEN;
if (!token) return { content: [{ type: "text" as const, text: "MY_API_TOKEN not set." }] };
```

Pros: one env var, no flows. Cons: not shareable across users.

### OAuth via Convex `connections` table

Best if you're deploying this for other people.

```ts
const conn = await ctx.getConnection("my-service");
if (!conn) return authError();
const token = conn.accessToken;
```

You'll need to build the OAuth flow yourself (not included in the template). Store the result with `convex.mutation(api.connections.upsert, {...})`.

### Hybrid (recommended starter)

Fall back: env → connection. Both examples use this pattern. See `integrations/notion/index.ts:getToken`.

---

## External actions: use the draft flow

The template ships a full draft system. Execution agents have a `save_draft(kind, summary, payload)` tool (via the built-in `boop-drafts` MCP). The interaction agent has `list_drafts`, `send_draft(draftId, integrations)`, and `reject_draft`.

When you write a send/create tool in your integration:

1. Include a warning in its description: *"DO NOT call directly — use save_draft from boop-drafts. Only reachable when send_draft approves."*
2. Keep the tool itself functional — `send_draft` will spawn a fresh execution agent with the payload as its task, and that agent needs the real send tool to actually commit.

See `integrations/gmail/index.ts:send_email` and `integrations/slack/index.ts:send_message` for the pattern.

---

## Returning results

Always return:

```ts
{ content: [{ type: "text" as const, text: "..." }] }
```

Keep it compact. The model reads every byte — a 10KB tool result eats your context window fast. Summarize on the server side when you can.

On error:
```ts
{ content: [{ type: "text" as const, text: `Error: ${String(err)}` }] }
```

Don't throw. The model should see the error and decide what to do.

---

## Testing an integration

The fastest loop is the debug dashboard's Chat tab (`http://localhost:5173`). It talks to `/chat` directly — no Sendblue required.

Ask the agent: *"use the weather integration to check tomorrow's forecast for New York"*. You'll see the spawn, the tool call, and the result in the Agents tab.

---

## Pro moves

- **Many small tools > one big tool.** `list_events` + `get_event` + `create_event` is easier for the model to reason about than `calendar(action, payload)`.
- **Log what you care about.** Anything you want visible in the dashboard can go through `convex.mutation(api.agents.addLog, ...)` — see how `execution-agent.ts` does it automatically for text/tool_use/tool_result.
- **Cache aggressively.** If your integration hits a slow API, memoize per-conversation in a module-level Map keyed on `ctx.conversationId`.
- **Chain integrations.** A sub-agent can use multiple integrations in one spawn — just pass them all in `integrations: []`.
