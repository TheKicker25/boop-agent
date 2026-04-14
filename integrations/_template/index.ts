/**
 * Integration template.
 *
 * Copy this folder, rename it, and:
 *   1. Change the `name` in `register()`.
 *   2. Swap in your real tools (see /integrations/google-calendar/index.ts for a working one).
 *   3. Import and call this file's `register` from server/integrations/registry.ts.
 *
 * An integration = an MCP server that the execution agent can load per-task.
 * Each `tool(...)` below becomes a callable tool the Claude agent can use.
 */

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { IntegrationContext, IntegrationModule } from "../../server/integrations/registry.js";

const INTEGRATION_NAME = "my-integration";

function build(_ctx: IntegrationContext) {
  return createSdkMcpServer({
    name: INTEGRATION_NAME,
    version: "0.1.0",
    tools: [
      tool(
        "hello",
        "Example tool. Returns a greeting. Replace me with something useful.",
        { who: z.string().describe("Name to greet.") },
        async (args) => ({
          content: [{ type: "text" as const, text: `Hello, ${args.who}!` }],
        }),
      ),
    ],
  });
}

const mod: IntegrationModule = {
  name: INTEGRATION_NAME,
  description: "Example integration. Copy this folder to add your own.",
  requiredEnv: [],
  createServer: async (ctx) => build(ctx),
};

export function register(opts: {
  registerIntegration: (m: IntegrationModule) => void;
}): void {
  // Uncomment when you want this integration to load:
  // opts.registerIntegration(mod);
  void mod;
  void opts;
}
