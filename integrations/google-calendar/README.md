# Google Calendar

Lets the agent read the user's calendar and draft events.

## Enable this integration

It ships disabled. Uncomment the import in `server/integrations/registry.ts`:

```ts
const loaders = [
  import("../../integrations/google-calendar/index.js"),  // ← uncomment
  // ...
];
```

Restart the server.

## Tools

- `list_events` — upcoming events (default next 7 days)
- `get_event` — details by event ID
- `create_event` — create an event (draft-confirm pattern)

## Setup

The easiest path is an OAuth refresh token you keep in `.env.local`:

1. **Create a Google Cloud project** → https://console.cloud.google.com/
2. **Enable the Calendar API** for your project.
3. **Create OAuth credentials** (type: Desktop app) and note the client ID + secret.
4. **Get a refresh token** — use the OAuth playground (https://developers.google.com/oauthplayground) with scope `https://www.googleapis.com/auth/calendar`. In the playground gear menu, paste your own client ID/secret so the refresh token is long-lived.
5. **Add to `.env.local`:**
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   ```

The integration refreshes access tokens on each tool call.

## Extending

- Add `update_event` / `delete_event` tools — same pattern as `create_event`.
- Add multi-calendar support by parameterizing the calendar ID (currently hardcoded to `primary`).
- Swap env-based auth for OAuth connections stored in Convex: remove the env-check, use `ctx.getConnection("google-calendar")` only.
