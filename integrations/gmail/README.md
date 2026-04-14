# Gmail

Lets the agent search, read, and send email.

## Enable this integration

It ships disabled. Uncomment the import in `server/integrations/registry.ts`:

```ts
const loaders = [
  import("../../integrations/gmail/index.js"),  // ← uncomment
  // ...
];
```

Restart the server.

## Tools

- `search` — Gmail query syntax (`from:`, `subject:`, `newer_than:2d`, etc.)
- `get_message` — full body by ID
- `send_email` — the execution agent **does not** call this directly. It drafts via `save_draft`. The interaction agent's `send_draft` tool triggers the actual send.

## Setup

Reuses the same OAuth setup as `google-calendar`. Add the Gmail scope when generating the refresh token:

- Scope: `https://www.googleapis.com/auth/gmail.modify`

If you already have `GOOGLE_REFRESH_TOKEN` for Calendar, regenerate it at the OAuth playground with both scopes selected.

## Safety

The integration's `send_email` tool description reinforces that execution agents must use `save_draft`. You can also delete the tool entirely if you only want reading capability.
