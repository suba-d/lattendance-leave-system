import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              出勤系統
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="hover:underline">
                首頁
              </Link>
              <Link href="/leave/new" className="hover:underline">
                請假
              </Link>
              <Link href="/leave" className="hover:underline">
                我的請假
              </Link>
              <Link href="/attendance" className="hover:underline">
                我的打卡
              </Link>
              {isAdmin ? (
                <Link href="/admin" className="hover:underline font-medium">
                  管理
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="muted">{session.user.name}</span>
            <form action={logoutAction}>
              <button type="submit" className="btn">
                登出
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
