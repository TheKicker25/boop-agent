import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { api } from "../../convex/_generated/api.js";
import { convex } from "../convex-client.js";

export interface IntegrationModule {
  name: string;
  description: string;
  requiredEnv?: string[];
  createServer: (ctx: IntegrationContext) => Promise<McpSdkServerConfigWithInstance>;
}

export interface IntegrationContext {
  conversationId?: string;
  getConnection: (service: string) => Promise<{
    accessToken: string;
    refreshToken?: string;
    metadata?: Record<string, unknown>;
  } | null>;
}

const registry = new Map<string, IntegrationModule>();

export function registerIntegration(mod: IntegrationModule): void {
  registry.set(mod.name, mod);
}

export function listIntegrations(): IntegrationModule[] {
  return [...registry.values()];
}

export function getIntegration(name: string): IntegrationModule | undefined {
  return registry.get(name);
}

export async function loadIntegrations(): Promise<void> {
  // Integrations are OFF by default so the first run works with zero setup.
  // To enable one:
  //   1. Uncomment its line below.
  //   2. Add the env vars it needs (see integrations/<name>/README.md).
  //   3. Restart the server.
  const loaders: Promise<{ register?: (opts: { registerIntegration: typeof registerIntegration }) => void }>[] = [
    // import("../../integrations/google-calendar/index.js"),
    // import("../../integrations/gmail/index.js"),
    // import("../../integrations/notion/index.js"),
    // import("../../integrations/slack/index.js"),
  ];
  for (const loader of loaders) {
    try {
      const mod = await loader;
      if (typeof mod.register === "function") mod.register({ registerIntegration });
    } catch (err) {
      console.warn("[integrations] failed to load", err);
    }
  }
  const loaded = [...registry.keys()];
  console.log(
    `[integrations] loaded: ${loaded.join(", ") || "(none — see server/integrations/registry.ts to enable examples)"}`,
  );
}

export function makeContext(conversationId?: string): IntegrationContext {
  return {
    conversationId,
    async getConnection(service) {
      const conns = await convex.query(api.connections.getByService, { service });
      const conn = conns[0];
      if (!conn) return null;
      return {
        accessToken: conn.accessToken,
        refreshToken: conn.refreshToken,
        metadata: conn.metadata ? JSON.parse(conn.metadata) : undefined,
      };
    },
  };
}

export async function buildMcpServersForIntegrations(
  names: string[],
  conversationId?: string,
): Promise<Record<string, McpSdkServerConfigWithInstance>> {
  const ctx = makeContext(conversationId);
  const out: Record<string, McpSdkServerConfigWithInstance> = {};
  for (const name of names) {
    const mod = registry.get(name);
    if (!mod) {
      console.warn(`[integrations] unknown integration: ${name}`);
      continue;
    }
    try {
      out[name] = await mod.createServer(ctx);
    } catch (err) {
      console.error(`[integrations] failed to build ${name}`, err);
    }
  }
  return out;
}
