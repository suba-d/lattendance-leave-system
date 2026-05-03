"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Admin manually edits a (user × leaveType × year) balance.
//
//   totalDays  → LeaveBalance.totalHours  (年度配額)
//   adjustDays → LeaveBalance.adjustHours (臨時加減，可正可負)
//
// Display formula in the rest of the app:
//   remaining = totalHours + adjustHours - usedHours
//
// Days are converted to hours (× 8) at this boundary so the rest of the
// system keeps using hours internally.
export async function updateLeaveBalanceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const leaveTypeId = String(formData.get("leaveTypeId") || "");
  const totalDaysRaw = String(formData.get("totalDays") || "");
  const adjustDaysRaw = String(formData.get("adjustDays") || "0");

  if (!userId || !leaveTypeId) {
    redirect(`/admin/users/${userId}?error=invalid`);
  }

  const totalDays = Number(totalDaysRaw);
  const adjustDays = Number(adjustDaysRaw);
  if (!Number.isFinite(totalDays) || totalDays < 0 || totalDays > 9999) {
    redirect(`/admin/users/${userId}?error=invalid_total`);
  }
  if (!Number.isFinite(adjustDays) || adjustDays < -9999 || adjustDays > 9999) {
    redirect(`/admin/users/${userId}?error=invalid_adjust`);
  }

  const year = new Date().getFullYear();
  const totalHours = new Prisma.Decimal(totalDays * 8);
  const adjustHours = new Prisma.Decimal(adjustDays * 8);

  await prisma.leaveBalance.upsert({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
    update: {
      totalHours,
      adjustHours,
      notes: "manually edited by admin",
    },
    create: {
      userId,
      leaveTypeId,
      year,
      totalHours,
      adjustHours,
      notes: "manually edited by admin",
    },
  });

  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?saved=1`);
}
