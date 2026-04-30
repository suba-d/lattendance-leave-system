// Centralized environment access. Keep all process.env reads here so the
// rest of the app can import typed helpers.

// Linux POSIX environments may set TZ with a leading ":" prefix
// (e.g. ":UTC"), which is the OS default rather than an explicit
// operator choice. Treat such values as "not set" and fall back to
// the office default — otherwise an Amplify build leak silently
// shifts every displayed time to UTC.
function sanitizeTz(raw: string | undefined): string {
  if (!raw) return "Asia/Taipei";
  if (raw.startsWith(":")) return "Asia/Taipei";
  const cleaned = raw.trim();
  return cleaned || "Asia/Taipei";
}

export const TZ = sanitizeTz(process.env.TZ);

export const WORK_START_HOUR = Number(process.env.WORK_START_HOUR ?? 9);
export const WORK_END_HOUR = Number(process.env.WORK_END_HOUR ?? 18);

export const TRUST_PROXY = (process.env.TRUST_PROXY ?? "true").toLowerCase() === "true";

export const OFFICE_IP_ALLOWLIST = (process.env.OFFICE_IP_ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
export const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
export const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = (
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || ""
).replace(/\\n/g, "\n");

export const googleCalendarEnabled =
  !!GOOGLE_CALENDAR_ID &&
  !!GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  !!GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

// --- LINE Messaging API (bot push + webhook) ---
export const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
export const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
// Falls back to AppSetting "line.targetId" when this env var is absent.
export const LINE_TARGET_ID_ENV = process.env.LINE_TARGET_ID || "";

// --- LINE Login (OAuth) ---
// Same channel as Messaging API works if you enable both products on it.
export const LINE_LOGIN_CHANNEL_ID =
  process.env.LINE_LOGIN_CHANNEL_ID || process.env.LINE_CHANNEL_ID || "";
export const LINE_LOGIN_CHANNEL_SECRET =
  process.env.LINE_LOGIN_CHANNEL_SECRET || LINE_CHANNEL_SECRET || "";

// --- LIFF ---
// Public ID — exposed to the browser.
export const NEXT_PUBLIC_LIFF_ID =
  process.env.NEXT_PUBLIC_LIFF_ID || process.env.LIFF_ID || "";

// --- Public app URL (for LINE callbacks, invite links) ---
export const APP_URL = process.env.APP_URL || process.env.AUTH_URL || "";

export const lineMessagingEnabled = !!LINE_CHANNEL_ACCESS_TOKEN;
export const lineLoginEnabled =
  !!LINE_LOGIN_CHANNEL_ID && !!LINE_LOGIN_CHANNEL_SECRET;
