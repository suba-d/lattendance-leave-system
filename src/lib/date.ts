import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TZ } from "./env";

export function nowInOfficeTZ(): Date {
  return toZonedTime(new Date(), TZ);
}

// Returns YYYY-MM-DD in office timezone.
export function workDateString(d: Date = new Date()): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

// Parse a YYYY-MM-DD string into a UTC-midnight Date. We deliberately use UTC
// midnight (not office-TZ midnight) so the value round-trips through Postgres
// `@db.Date` columns cleanly regardless of the connection's timezone.
export function parseWorkDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

export function formatDateTimeInOfficeTZ(d: Date, fmt = "yyyy-MM-dd HH:mm"): string {
  return formatInTimeZone(d, TZ, fmt);
}
