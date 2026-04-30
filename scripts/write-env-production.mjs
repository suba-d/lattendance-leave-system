// Amplify Hosting injects certain env vars only into Node subprocess
// environment (visible via process.env) but NOT into the shell
// environment (not visible to /usr/bin/env). The earlier shell-based
// `env | grep ... > .env.production` approach silently dropped those
// vars — most notably LINE_* and SEED_ADMIN_* — and the runtime
// Lambda then couldn't see them either.
//
// This script runs in Node, sees what Node sees, and writes the
// matching keys to .env.production. Run it from amplify.yml in
// place of the previous shell sweep.

import fs from "node:fs";

const ALLOWLIST_EXACT = new Set([
  "AUTH_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "APP_URL",
  "AUTH_URL",
  "TRUST_PROXY",
  "OFFICE_IP_ALLOWLIST",
  "WORK_START_HOUR",
  "WORK_END_HOUR",
  "NEXT_PUBLIC_LIFF_ID",
]);
const ALLOWLIST_PREFIXES = ["SEED_ADMIN_", "GOOGLE_", "LINE_"];

function shouldKeep(key) {
  if (ALLOWLIST_EXACT.has(key)) return true;
  return ALLOWLIST_PREFIXES.some((p) => key.startsWith(p));
}

const lines = [];
const keys = [];
for (const key of Object.keys(process.env).sort()) {
  if (!shouldKeep(key)) continue;
  const value = process.env[key];
  if (value === undefined || value === "") continue;
  // Newlines in values would corrupt the .env format; escape them.
  const escaped = String(value).replace(/\r?\n/g, "\\n");
  lines.push(`${key}=${escaped}`);
  keys.push(key);
}

fs.writeFileSync(".env.production", lines.join("\n") + "\n");

console.log("==> .env.production captured keys:");
for (const k of keys) console.log("   - " + k);
console.log(`(total: ${keys.length})`);
