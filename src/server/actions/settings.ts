"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import {
  getEffectiveAllowlist,
  isValidIpRule,
  setEffectiveAllowlist,
  extractClientIp,
} from "@/lib/ip-allowlist";

export async function saveIpAllowlistAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = String(formData.get("rules") || "");
  // Accept newline / comma / whitespace as separators.
  const candidates = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const invalid = candidates.filter((s) => !isValidIpRule(s));
  if (invalid.length > 0) {
    redirect(
      `/admin/settings?error=${encodeURIComponent(
        `格式錯誤的項目：${invalid.join(", ")}`,
      )}`,
    );
  }
  await setEffectiveAllowlist(candidates);
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

export async function clearIpAllowlistAction(): Promise<void> {
  await requireAdmin();
  await setEffectiveAllowlist([]);
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

export async function getCurrentRequestIp(): Promise<string | null> {
  const h = await headers();
  return extractClientIp(h);
}

export { getEffectiveAllowlist };
