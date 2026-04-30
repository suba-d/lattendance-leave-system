"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const upsertSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1).max(80),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  hireDate: z.string().min(1),
  active: z.coerce.boolean().default(true),
  password: z.string().min(8).optional(),
});

export async function upsertUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role") || Role.EMPLOYEE,
    hireDate: formData.get("hireDate"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/users?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "欄位錯誤")}`);
  }
  const data = parsed.data;
  const hireDate = new Date(data.hireDate);
  if (Number.isNaN(hireDate.getTime())) {
    redirect(`/admin/users?error=${encodeURIComponent("到職日格式錯誤")}`);
  }

  if (data.id) {
    const updateData: Record<string, unknown> = {
      email: data.email.toLowerCase(),
      name: data.name,
      role: data.role,
      hireDate,
      active: data.active,
    };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    await prisma.user.update({ where: { id: data.id }, data: updateData });
  } else {
    if (!data.password) {
      redirect(`/admin/users?error=${encodeURIComponent("新增員工時必須提供密碼")}`);
    }
    const passwordHash = await bcrypt.hash(data.password!, 10);
    await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role,
        hireDate,
        active: data.active,
        passwordHash,
      },
    });
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function deactivateUserAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { active: false } });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function activateUserAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { active: true } });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}
