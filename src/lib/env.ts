// Centralized environment access. Keep all process.env reads here so the
// rest of the app can import typed helpers.

export const TZ = process.env.TZ || "Asia/Taipei";

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

export const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
export const LINE_TARGET_ID = process.env.LINE_TARGET_ID || "";

export const lineEnabled = !!LINE_CHANNEL_ACCESS_TOKEN && !!LINE_TARGET_ID;
