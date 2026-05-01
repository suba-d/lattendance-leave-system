"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ClockKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  extractClientIp,
  getEffectiveAllowlist,
  ipMatchesAllowlist,
} from "@/lib/ip-allowlist";
import { parseWorkDate, workDateString } from "@/lib/date";

export type ClockResult =
  | { ok: true; kind: "IN" | "OUT" }
  | { ok: false; error: string; ip?: string };

export async function clockAction(kind: "IN" | "OUT"): Promise<ClockResult> {
  const user = await requireUser();
  const h = await headers();
  const ip = extractClientIp(h);
  const ua = h.get("user-agent") || undefined;

  const allowlist = await getEffectiveAllowlist();
  if (allowlist.length > 0) {
    if (!ip) {
      return {
        ok: false,
        error: "無法判斷來源 IP，無法打卡。請聯絡管理員。",
      };
    }
    if (!ipMatchesAllowlist(ip, allowlist)) {
      return {
        ok: false,
        ip,
        error: [
          `這個網路無法打卡。`,
          `你目前的 IP：${ip}`,
          ``,
          `常見原因：`,
          `1. 沒連到公司 WiFi（用了 4G / 行動數據）`,
          `2. 開著 VPN（VPN 會把網路出口換成別的 IP）`,
          ``,
          `請確認後再試。`,
        ].join("\n"),
      };
    }
  }

  const today = workDateString();
  const workDate = parseWorkDate(today);

  // Prevent duplicate consecutive same-kind clocks within 1 minute (typo
  // protection). Otherwise allow multiple INs/OUTs (lunch break, re-entry).
  const lastSame = await prisma.clockEvent.findFirst({
    where: { userId: user.id, kind: kind as ClockKind, workDate },
    orderBy: { occurredAt: "desc" },
  });
  if (lastSame && Date.now() - lastSame.occurredAt.getTime() < 60_000) {
    return { ok: false, error: "剛才已打過卡，請稍候再試。" };
  }

  await prisma.clockEvent.create({
    data: {
      userId: user.id,
      kind: kind as ClockKind,
      workDate,
      ipAddress: ip,
      userAgent: ua,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/clock");
  revalidatePath("/attendance");
  return { ok: true, kind };
}
