#!/usr/bin/env node
// Pulls your Sendblue-provisioned number from `sendblue show-keys` and writes
// it to .env.local as SENDBLUE_FROM_NUMBER. Saves you from manually finding it.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const envPath = resolve(root, ".env.local");

function hasBinary(name) {
  return new Promise((ok) => {
    const p = spawn(process.platform === "win32" ? "where" : "which", [name], {
      stdio: "ignore",
    });
    p.on("exit", (code) => ok(code === 0));
    p.on("error", () => ok(false));
  });
}

function runCapture(cmd, args) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { cwd: root });
    let out = "";
    p.stdout.on("data", (d) => {
      const s = d.toString();
      out += s;
      process.stdout.write(s);
    });
    p.stderr.on("data", (d) => process.stderr.write(d));
    p.on("exit", (code) =>
      code === 0 ? ok(out) : fail(new Error(`${cmd} exited ${code}`)),
    );
    p.on("error", fail);
  });
}

function parsePhone(output) {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  try {
    const json = JSON.parse(clean);
    const n = json.phone_number ?? json.phoneNumber ?? json.number;
    if (n) return String(n);
  } catch {
    /* not JSON */
  }
  const m = clean.match(
    /(?:Phone[- ]?Number|From[- ]?Number|number)[:\s]+"?(\+?\d{10,15})/i,
  );
  return m ? m[1] : null;
}

async function main() {
  const useGlobal = await hasBinary("sendblue");
  const cmd = useGlobal ? "sendblue" : "npx";
  const leading = useGlobal ? [] : ["-y", "@sendblue/cli"];

  console.log(`Running \`${cmd} ${[...leading, "show-keys"].join(" ")}\`…\n`);

  let output;
  try {
    output = await runCapture(cmd, [...leading, "show-keys"]);
  } catch (err) {
    console.error(`\n✗ Command failed: ${err.message}`);
    console.error(
      `\nIf you aren't logged in yet, run:\n  npx @sendblue/cli login\nthen try again.`,
    );
    process.exit(1);
  }

  const phone = parsePhone(output);
  if (!phone) {
    console.error(`\n✗ Couldn't find a phone number in the CLI output above.`);
    console.error(
      `  If you have it handy, set it manually:  SENDBLUE_FROM_NUMBER=+14695551234 in .env.local`,
    );
    process.exit(1);
  }

  const normalized = phone.startsWith("+") ? phone : `+${phone}`;

  if (!existsSync(envPath)) {
    console.error(`\n✗ .env.local not found. Run \`npm run setup\` first.`);
    process.exit(1);
  }

  let content = readFileSync(envPath, "utf8");
  if (/^SENDBLUE_FROM_NUMBER=.*$/m.test(content)) {
    content = content.replace(
      /^SENDBLUE_FROM_NUMBER=.*$/m,
      `SENDBLUE_FROM_NUMBER=${normalized}`,
    );
  } else {
    content = content.trimEnd() + `\nSENDBLUE_FROM_NUMBER=${normalized}\n`;
  }
  writeFileSync(envPath, content);

  console.log(`\n✓ Updated .env.local → SENDBLUE_FROM_NUMBER=${normalized}`);
  console.log(`  Restart \`npm run dev\` to pick up the change.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
