"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LeaveStatus, LeaveUnit, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createLeaveEvent, deleteLeaveEvent } from "@/lib/google-calendar";
import { pushLineText } from "@/lib/line";
import { formatGroupLeaveNotice } from "@/lib/leave-format";

const submitSchema = z.object({
  leaveTypeId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  unit: z.nativeEnum(LeaveUnit).default("DAY"),
  reason: z.string().max(2000).optional(),
});

function calcHours(startAt: Date, endAt: Date, unit: LeaveUnit): number {
  if (endAt <= startAt) return 0;
  const ms = endAt.getTime() - startAt.getTime();
  if (unit === LeaveUnit.HOUR) {
    return Math.round((ms / 3_600_000) * 100) / 100;
  }
  if (unit === LeaveUnit.HALF_DAY) {
    return 4;
  }
  // DAY: count workdays inclusive (Mon-Fri). Holidays out of scope.
  let days = 0;
  const cur = new Date(startAt);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(endAt);
  last.setUTCHours(0, 0, 0, 0);
  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days * 8;
}

export type LeaveSubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitLeaveAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = submitSchema.safeParse({
    leaveTypeId: formData.get("leaveTypeId"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    unit: formData.get("unit") || "DAY",
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    redirect(`/leave/new?error=${encodeURIComponent("欄位錯誤")}`);
  }
  const data = parsed.data;
  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    redirect(`/leave/new?error=${encodeURIComponent("日期格式錯誤")}`);
  }
  if (endAt <= startAt) {
    redirect(`/leave/new?error=${encodeURIComponent("結束時間必須晚於開始時間")}`);
  }

  const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
  if (!leaveType || !leaveType.active) {
    redirect(`/leave/new?error=${encodeURIComponent("假別無效")}`);
  }

  const hours = calcHours(startAt, endAt, data.unit);

  const created = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      leaveTypeId: data.leaveTypeId,
      startAt,
      endAt,
      unit: data.unit,
      hours: new Prisma.Decimal(hours),
      reason: data.reason,
      status: LeaveStatus.ACTIVE,
    },
    include: { leaveType: true, user: true },
  });

  // Fire-and-forget integrations. Failures are logged but do not block.
  void syncLeaveIntegrations(created.id).catch((err) => {
    console.error("leave integrations sync failed", err);
  });

  revalidatePath("/leave");
  revalidatePath("/dashboard");
  redirect("/leave?submitted=1");
}

export async function cancelLeaveAction(id: string): Promise<void> {
  const user = await requireUser();
  const lr = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!lr) redirect("/leave?error=notfound");
  if (lr.userId !== user.id && user.role !== "ADMIN") {
    redirect("/leave?error=forbidden");
  }
  if (lr.status === LeaveStatus.CANCELED) {
    redirect("/leave");
  }
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: LeaveStatus.CANCELED, canceledAt: new Date() },
  });
  if (lr.googleEventId) {
    void deleteLeaveEvent(lr.googleEventId).catch((err) => {
      console.error("calendar delete failed", err);
    });
  }
  revalidatePath("/leave");
  revalidatePath("/dashboard");
  redirect("/leave?canceled=1");
}

async function syncLeaveIntegrations(leaveId: string): Promise<void> {
  const lr = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { leaveType: true, user: true },
  });
  if (!lr) return;

  const summary = `${lr.user.name} ${lr.leaveType.name}`;
  const description = [
    `申請人: ${lr.user.name} <${lr.user.email}>`,
    `假別: ${lr.leaveType.name}`,
    `時數: ${lr.hours.toString()} 小時`,
    lr.reason ? `事由: ${lr.reason}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Treat full-day units as all-day events for cleaner calendar rendering.
  const allDay = lr.unit === LeaveUnit.DAY;

  try {
    const eventId = await createLeaveEvent({
      summary,
      description,
      startAt: lr.startAt,
      endAt: lr.endAt,
      allDay,
    });
    if (eventId) {
      await prisma.leaveRequest.update({
        where: { id: lr.id },
        data: { googleEventId: eventId },
      });
    }
  } catch (err) {
    console.error("calendar create failed", err);
  }

  try {
    // Privacy-aware: name + date(s) + (time range) + leave type. No reason.
    const message = formatGroupLeaveNotice({
      userName: lr.user.name,
      leaveTypeName: lr.leaveType.name,
      startAt: lr.startAt,
      endAt: lr.endAt,
      unit: lr.unit,
    });
    const sent = await pushLineText(message);
    if (sent) {
      await prisma.leaveRequest.update({
        where: { id: lr.id },
        data: { lineNotifiedAt: new Date() },
      });
    }
  } catch (err) {
    console.error("line push failed", err);
  }
}
