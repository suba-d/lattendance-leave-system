import { google } from "googleapis";
import {
  GOOGLE_CALENDAR_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  TZ,
  googleCalendarEnabled,
} from "./env";

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

export type LeaveEventInput = {
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  // When true, treat as all-day events (uses date-only, exclusive end).
  allDay?: boolean;
};

export async function createLeaveEvent(input: LeaveEventInput): Promise<string | null> {
  if (!googleCalendarEnabled) return null;
  const calendar = getCalendarClient();

  const start = input.allDay
    ? { date: toDateOnly(input.startAt), timeZone: TZ }
    : { dateTime: input.startAt.toISOString(), timeZone: TZ };
  const end = input.allDay
    ? { date: toDateOnly(addDays(input.endAt, 1)), timeZone: TZ }
    : { dateTime: input.endAt.toISOString(), timeZone: TZ };

  const res = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start,
      end,
    },
  });
  return res.data.id ?? null;
}

export async function deleteLeaveEvent(eventId: string): Promise<void> {
  if (!googleCalendarEnabled) return;
  const calendar = getCalendarClient();
  try {
    await calendar.events.delete({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId,
    });
  } catch (err: unknown) {
    // Treat 404/410 as already-deleted.
    const status = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;
    if (status === 404 || status === 410) return;
    throw err;
  }
}

function toDateOnly(d: Date): string {
  // Format as YYYY-MM-DD using office timezone.
  // We avoid pulling date-fns-tz in this helper to keep the file self-contained.
  const offsetMs = d.getTimezoneOffset() * 60_000;
  // Format the absolute instant as the office's local date.
  // Quick path: use Intl to get YYYY-MM-DD in TZ.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  void offsetMs;
  return fmt.format(d);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
