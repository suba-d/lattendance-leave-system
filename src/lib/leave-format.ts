import { LeaveUnit } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "./env";

// Privacy-aware group notification format. Mirrors the policy chosen by the
// company:
//   - Show:   employee name, date(s), time range when partial, leave type
//   - Hide:   reason / free-text notes
//
// Examples:
//   david 5/2 全天 病假
//   david 5/2-5/4 全天 病假
//   david 5/2 09:00-18:00 病假
//   david 5/2 09:00 ~ 5/3 18:00 病假
export function formatGroupLeaveNotice(args: {
  userName: string;
  leaveTypeName: string;
  startAt: Date;
  endAt: Date;
  unit: LeaveUnit;
}): string {
  const { userName, leaveTypeName, startAt, endAt, unit } = args;

  const sameDay =
    formatInTimeZone(startAt, TZ, "yyyy-MM-dd") ===
    formatInTimeZone(endAt, TZ, "yyyy-MM-dd");

  if (unit === LeaveUnit.DAY) {
    if (sameDay) {
      return `${userName} ${md(startAt)} 全天 ${leaveTypeName}`;
    }
    return `${userName} ${md(startAt)}-${md(endAt)} 全天 ${leaveTypeName}`;
  }

  if (unit === LeaveUnit.HALF_DAY) {
    return `${userName} ${md(startAt)} ${hm(startAt)}-${hm(endAt)} ${leaveTypeName}`;
  }

  // HOUR — show time range; if cross-day, include both dates.
  if (sameDay) {
    return `${userName} ${md(startAt)} ${hm(startAt)}-${hm(endAt)} ${leaveTypeName}`;
  }
  return `${userName} ${md(startAt)} ${hm(startAt)} ~ ${md(endAt)} ${hm(endAt)} ${leaveTypeName}`;
}

function md(d: Date): string {
  return formatInTimeZone(d, TZ, "M/d");
}

function hm(d: Date): string {
  return formatInTimeZone(d, TZ, "HH:mm");
}
