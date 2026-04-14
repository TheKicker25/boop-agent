# Notion

Lets the agent search, read, and create pages in Notion.

## Enable this integration

It ships disabled. Uncomment the import in `server/integrations/registry.ts`:

```ts
const loaders = [
  import("../../integrations/notion/index.js"),  // ← uncomment
  // ...
];
```

Restart the server.

## Tools

- `search` — search pages and databases shared with your integration
- `get_page` — full page content by ID
- `create_page` — create under a page or database (draft-confirm pattern)

## Setup

1. Go to https://www.notion.so/profile/integrations → **New integration** (type: Internal).
2. Name it (e.g. "Boop"), submit, copy the **Internal Integration Secret**.
3. Add to `.env.local`:
   ```
   NOTION_TOKEN=secret_xxx
   ```
4. **Share pages with the integration** — open any Notion page you want the agent to see, click "..." → "Connections" → add your integration. The integration only sees pages explicitly shared with it.

## Extending

- Add `update_page`, `append_blocks`, `query_database` with filters.
- To use Notion's hosted MCP server instead of direct API, point the execution agent at `https://mcp.notion.com/sse` — requires OAuth discovery, worth the complexity only if you want shareable multi-user deployments.
