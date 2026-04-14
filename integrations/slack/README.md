# Slack

Lets the agent search, read, and post to Slack.

## Enable this integration

It ships disabled. Uncomment the import in `server/integrations/registry.ts`:

```ts
const loaders = [
  import("../../integrations/slack/index.js"),  // ← uncomment
  // ...
];
```

Restart the server.

## Tools

- `search` — search messages the token can see
- `list_channels` — list visible channels
- `channel_history` — recent messages in a channel
- `send_message` — posts to a channel (execution agent **drafts first**, interaction agent confirms)

## Setup — quickest path (personal Slack)

1. Go to https://api.slack.com/apps → **Create New App** (from scratch).
2. OAuth & Permissions → add bot scopes: `channels:read`, `channels:history`, `groups:read`, `groups:history`, `im:read`, `im:history`, `chat:write`, `search:read`, `users:read`.
3. Install the app to your workspace. Copy the **Bot User OAuth Token** (`xoxb-...`).
4. Add to `.env.local`:
   ```
   SLACK_BOT_TOKEN=xoxb-...
   ```
5. Invite the bot to any channel you want it to see: `/invite @<your-app-name>`.

## Notes

- `search.messages` requires a **user** token (`xoxp-...`), not a bot token. If you want search, use `SLACK_USER_TOKEN` instead of (or alongside) `SLACK_BOT_TOKEN`.
- For multi-user deployments, swap to the OAuth flow — the `connections` table already supports it.
