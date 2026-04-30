"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function createBindInviteAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/admin/users?error=notfound");

  const token = randomBytes(24).toString("base64url");
  await prisma.lineBindInvite.create({
    data: {
      token,
      userId,
      createdBy: admin.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users?invite=${token}`);
}

export async function unbindLineAction(userId: string): Promise<void> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { lineUserId: null },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}
