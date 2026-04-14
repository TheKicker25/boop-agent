import express from "express";
import crypto from "node:crypto";
import { api } from "../convex/_generated/api.js";
import { convex } from "./convex-client.js";

interface ProviderConfig {
  service: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId?: string;
  clientSecret?: string;
  extraAuthParams?: Record<string, string>;
  parseToken?: (data: any) => {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    accountLabel?: string;
    metadata?: Record<string, unknown>;
  };
}

const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    service: "google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    parseToken: (data) => ({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    }),
  },
  slack: {
    service: "slack",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: [
      "channels:read",
      "channels:history",
      "groups:read",
      "groups:history",
      "chat:write",
      "users:read",
    ],
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    parseToken: (data) => ({
      accessToken: data.access_token ?? data.authed_user?.access_token,
      refreshToken: data.refresh_token,
      accountLabel: data.team?.name,
      metadata: { team: data.team, scope: data.scope, bot_user_id: data.bot_user_id },
    }),
  },
};

const stateStore = new Map<string, { provider: string; createdAt: number }>();

function publicUrl(): string {
  return (process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3456}`).replace(
    /\/$/,
    "",
  );
}

function redirectUri(provider: string): string {
  return `${publicUrl()}/oauth/${provider}/callback`;
}

export function listProviders(): Array<{
  name: string;
  configured: boolean;
  scopes: string[];
  redirectUri: string;
}> {
  return Object.entries(PROVIDERS).map(([name, cfg]) => ({
    name,
    configured: Boolean(cfg.clientId && cfg.clientSecret),
    scopes: cfg.scopes,
    redirectUri: redirectUri(name),
  }));
}

export function createOAuthRouter(): express.Router {
  const router = express.Router();

  router.get("/providers", (_req, res) => {
    res.json(listProviders());
  });

  router.get("/:provider/start", (req, res) => {
    const provider = PROVIDERS[req.params.provider];
    if (!provider) {
      res.status(404).json({ error: "unknown provider" });
      return;
    }
    if (!provider.clientId || !provider.clientSecret) {
      res.status(400).json({
        error: `${provider.service} client id/secret not configured. Set them in .env.local.`,
      });
      return;
    }
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, { provider: req.params.provider, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri(req.params.provider),
      response_type: "code",
      scope: provider.scopes.join(" "),
      state,
      ...(provider.extraAuthParams ?? {}),
    });
    res.redirect(`${provider.authUrl}?${params}`);
  });

  router.get("/:provider/callback", async (req, res) => {
    const provider = PROVIDERS[req.params.provider];
    if (!provider) {
      res.status(404).send("unknown provider");
      return;
    }
    const { code, state, error } = req.query as Record<string, string>;
    if (error) {
      res.status(400).send(`OAuth error: ${error}`);
      return;
    }
    if (!code || !state || !stateStore.has(state)) {
      res.status(400).send("missing or invalid state");
      return;
    }
    stateStore.delete(state);

    try {
      const body = new URLSearchParams({
        code,
        client_id: provider.clientId!,
        client_secret: provider.clientSecret!,
        redirect_uri: redirectUri(req.params.provider),
        grant_type: "authorization_code",
      });
      const tokenRes = await fetch(provider.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || tokenJson.error) {
        res.status(400).json({ error: tokenJson.error ?? "token exchange failed", tokenJson });
        return;
      }
      const parsed = provider.parseToken!(tokenJson);

      await convex.mutation(api.connections.upsert, {
        connectionId: `${provider.service}:${Date.now()}`,
        service: provider.service,
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        tokenExpiresAt: parsed.expiresAt,
        accountLabel: parsed.accountLabel,
        scopes: provider.scopes,
        metadata: parsed.metadata ? JSON.stringify(parsed.metadata) : undefined,
      });

      res.send(`<!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>Connected ${provider.service}.</h1>
        <p>You can close this window.</p>
        <script>setTimeout(() => window.close(), 800);</script>
      </body></html>`);
    } catch (err) {
      console.error("[oauth] callback error", err);
      res.status(500).send(`OAuth callback failed: ${String(err)}`);
    }
  });

  return router;
}
