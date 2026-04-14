#!/usr/bin/env tsx
import prompts from "prompts";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const ENV_PATH = resolve(ROOT, ".env.local");
const EXAMPLE_PATH = resolve(ROOT, ".env.example");

function readEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const lines = readFileSync(path, "utf8").split("\n");
  const env: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function writeEnv(path: string, env: Record<string, string>): void {
  const example = existsSync(EXAMPLE_PATH) ? readFileSync(EXAMPLE_PATH, "utf8") : "";
  const keys = [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]);
  for (const k of Object.keys(env)) if (!keys.includes(k)) keys.push(k);

  let out = "";
  const sections = example.split(/\n(?=# ----)/);
  for (const section of sections) {
    const sectionKeys = [...section.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]);
    let s = section;
    for (const k of sectionKeys) {
      const v = env[k] ?? "";
      s = s.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`);
    }
    out += s + "\n";
  }
  writeFileSync(path, out.trim() + "\n");
}

function banner(s: string) {
  console.log("\n" + "━".repeat(60));
  console.log("  " + s);
  console.log("━".repeat(60));
}

async function runConvexDev(): Promise<void> {
  console.log("\nLaunching `npx convex dev --once` to configure your deployment.");
  console.log("Convex will open a browser window if you're not logged in.");
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("npx", ["convex", "dev", "--once", "--configure", "new"], {
      stdio: "inherit",
      cwd: ROOT,
    });
    child.on("exit", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`convex dev exited ${code}`)),
    );
  });
}

async function main() {
  banner("boop-agent setup");

  console.log(`
What this does:
  1. Prompts you for Sendblue + Claude config
  2. Runs \`npx convex dev\` to create a Convex project
  3. Writes .env.local

Before you start:
  • Sendblue account + number:     https://sendblue.co
  • A Claude Code subscription:    https://claude.com/code
  • Convex account (free tier):    https://convex.dev
`);

  const existing = readEnv(ENV_PATH);

  const answers = await prompts(
    [
      {
        type: "text",
        name: "SENDBLUE_API_KEY",
        message: "Sendblue API key id (sb-api-key-id value)",
        initial: existing.SENDBLUE_API_KEY ?? "",
      },
      {
        type: "password",
        name: "SENDBLUE_API_SECRET",
        message: "Sendblue API secret",
        initial: existing.SENDBLUE_API_SECRET ?? "",
      },
      {
        type: "text",
        name: "SENDBLUE_FROM_NUMBER",
        message: "Sendblue from-number (e.g. +15551234567)",
        initial: existing.SENDBLUE_FROM_NUMBER ?? "",
      },
      {
        type: "select",
        name: "BOOP_MODEL",
        message: "Which Claude model should the agent use?",
        choices: [
          { title: "claude-sonnet-4-6 (recommended)", value: "claude-sonnet-4-6" },
          { title: "claude-opus-4-6 (slowest, most capable)", value: "claude-opus-4-6" },
          { title: "claude-haiku-4-5 (fastest, cheapest)", value: "claude-haiku-4-5" },
        ],
        initial: 0,
      },
      {
        type: "text",
        name: "PUBLIC_URL",
        message: "Public URL for Sendblue webhooks (use ngrok for local dev)",
        initial: existing.PUBLIC_URL ?? "http://localhost:3456",
      },
      {
        type: "text",
        name: "PORT",
        message: "Local server port",
        initial: existing.PORT ?? "3456",
      },
      {
        type: "confirm",
        name: "runConvex",
        message: "Run `convex dev` now to configure your Convex deployment?",
        initial: true,
      },
    ],
    {
      onCancel: () => {
        console.log("Setup cancelled.");
        process.exit(1);
      },
    },
  );

  const env: Record<string, string> = { ...existing, ...answers };
  delete (env as any).runConvex;
  writeEnv(ENV_PATH, env);

  banner("Claude authentication");
  console.log(`This project uses your Claude Code subscription — no Anthropic API key needed.

If you haven't already:
  • Install Claude Code:  npm install -g @anthropic-ai/claude-code
  • Run once:              claude
  • Sign in when prompted

The Claude Agent SDK reads the credentials Claude Code saves on disk.
You can override with ANTHROPIC_API_KEY in .env.local if you'd rather use an API key.
`);

  if (answers.runConvex) {
    await runConvexDev();
    console.log(
      "\nConvex wrote your deployment URL to .env.local. If VITE_CONVEX_URL is missing, copy CONVEX_URL to VITE_CONVEX_URL.",
    );
    const after = readEnv(ENV_PATH);
    if (after.CONVEX_URL && !after.VITE_CONVEX_URL) {
      writeEnv(ENV_PATH, { ...after, VITE_CONVEX_URL: after.CONVEX_URL });
    }
  } else {
    console.log("\nSkipped Convex. Run `npx convex dev` yourself when ready.");
  }

  banner("Done");
  console.log(`
Next steps:
  1. (Optional) add integrations — see INTEGRATIONS.md
  2. Start dev:         npm run dev
  3. Expose your port:  ngrok http ${answers.PORT}
  4. Point your Sendblue webhook at:  <ngrok-url>/sendblue/webhook
  5. Text your Sendblue number. The agent should reply.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
