import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <nav className="flex gap-3 text-sm border-b border-[var(--color-border)] pb-2">
        <Link href="/admin" className="hover:underline">總覽</Link>
        <Link href="/admin/users" className="hover:underline">員工</Link>
        <Link href="/admin/leave" className="hover:underline">請假紀錄</Link>
        <Link href="/admin/attendance" className="hover:underline">打卡紀錄</Link>
        <Link href="/admin/settings" className="hover:underline">設定</Link>
      </nav>
      {children}
    </div>
  );
}
