# Integration template

Copy this folder to add a new integration. An integration is an MCP server exposing one or more tools that a sub-agent can call.

## Steps

1. **Copy this folder** to `integrations/<your-name>/` and rename `INTEGRATION_NAME` in `index.ts`.
2. **Add your tools** — each `tool(name, description, schema, handler)` call becomes a tool the sub-agent can use. Keep tool descriptions specific: the model reads them to decide when to call them.
3. **Load it** — open `server/integrations/registry.ts` and add your folder to the `loaders` array.
4. **Uncomment `opts.registerIntegration(mod)`** in your `register()` function.
5. **Document env vars** — if your integration needs API keys, add them to `.env.example` and list them in `requiredEnv`.

## OAuth vs static tokens

- **Personal API token (simpler):** user pastes their token into `.env.local`. Best for personal use, low friction.
- **OAuth:** user clicks through a flow, token is stored in Convex `connections` table. Use `ctx.getConnection("service-name")` inside your tool handlers. Best for shareable apps.

## Tool-writing tips

- Write tool descriptions for the **model** — explain when to use it, what it returns, gotchas.
- Return `{ content: [{ type: "text", text: "..." }] }` from handlers.
- Catch errors and return them as text — don't throw. The model should see what failed.
- Keep return payloads small. The model reads every byte.
