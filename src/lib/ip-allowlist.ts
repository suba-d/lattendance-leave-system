import { OFFICE_IP_ALLOWLIST, TRUST_PROXY } from "./env";
import { prisma } from "./db";

const SETTING_KEY = "office.ip_allowlist";

// IP allowlist source order (highest precedence first):
//   1. AppSetting row keyed by SETTING_KEY (admin-managed via /admin/settings)
//      — present even when empty, which means "explicitly disabled"
//   2. OFFICE_IP_ALLOWLIST env var (only when DB row absent)
//   3. Empty → IP enforcement disabled
export async function getEffectiveAllowlist(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed.map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      // Bad JSON in DB — fall through to env fallback rather than error.
    }
  }
  return OFFICE_IP_ALLOWLIST;
}

export async function setEffectiveAllowlist(rules: string[]): Promise<void> {
  const cleaned = rules.map((r) => r.trim()).filter(Boolean);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(cleaned) },
    create: { key: SETTING_KEY, value: JSON.stringify(cleaned) },
  });
}

export function isValidIpRule(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (trimmed.includes(":")) {
    // IPv6 exact match (no CIDR support).
    try {
      new URL(`http://[${trimmed}]`);
      return true;
    } catch {
      return false;
    }
  }
  if (trimmed.includes("/")) {
    const [base, bitsStr] = trimmed.split("/");
    const bits = Number(bitsStr);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    return ipv4ToInt(base) !== null;
  }
  return ipv4ToInt(trimmed) !== null;
}

// Returns the first IP from a comma-separated XFF header, trimmed.
function parseXff(header: string | null | undefined): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first || null;
}

export function extractClientIp(headers: Headers): string | null {
  if (TRUST_PROXY) {
    const xff = parseXff(headers.get("x-forwarded-for"));
    if (xff) return xff;
    const real = headers.get("x-real-ip");
    if (real) return real.trim();
  }
  // Next.js doesn't expose the raw socket IP via headers; rely on proxy headers.
  return null;
}

// IPv4 helpers --------------------------------------------------------------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  // Force to unsigned 32-bit.
  return n >>> 0;
}

function matchIpv4(ip: string, rule: string): boolean {
  if (rule.includes("/")) {
    const [base, bitsStr] = rule.split("/");
    const bits = Number(bitsStr);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const ipInt = ipv4ToInt(ip);
    const baseInt = ipv4ToInt(base);
    if (ipInt === null || baseInt === null) return false;
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  }
  return ip === rule;
}

// IPv6 ----------------------------------------------------------------------
// Minimal IPv6 support: exact match only (no CIDR). Sufficient for a small
// office where IPv6 ranges are rarely whitelisted; admins can list them
// individually if needed.
function normalizeIpv6(ip: string): string | null {
  // Reject anything that doesn't look like IPv6.
  if (!ip.includes(":")) return null;
  try {
    // Use URL parsing as a cheap normalizer.
    const u = new URL(`http://[${ip}]`);
    return u.hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

export function ipMatchesAllowlist(ip: string, rules: string[]): boolean {
  if (rules.length === 0) return true; // empty = disabled
  // Strip IPv6 zone id if any.
  const cleaned = ip.includes("%") ? ip.split("%")[0] : ip;
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → strip the prefix for matching.
  const v4mapped = cleaned.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const candidate = v4mapped ? v4mapped[1] : cleaned;

  for (const rule of rules) {
    if (rule.includes(":")) {
      const a = normalizeIpv6(candidate);
      const b = normalizeIpv6(rule);
      if (a && b && a === b) return true;
    } else {
      if (matchIpv4(candidate, rule)) return true;
    }
  }
  return false;
}

export async function ipAllowlistEnabled(): Promise<boolean> {
  const rules = await getEffectiveAllowlist();
  return rules.length > 0;
}
