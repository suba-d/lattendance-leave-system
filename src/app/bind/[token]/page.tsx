import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { startBindAction } from "@/server/actions/bind-flow";

export const dynamic = "force-dynamic";

export default async function BindPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.lineBindInvite.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date() || !invite.user.active) {
    redirect("/bind/invalid");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">綁定 LINE 帳號</h1>
        <p className="muted text-sm mb-6">
          將你的 LINE 帳號綁定到員工
          <span className="font-medium text-[var(--color-text)]"> {invite.user.name}</span>
          ，之後你就可以用 LINE 直接登入。
        </p>
        <form action={startBindAction.bind(null, token)}>
          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ background: "#06C755", borderColor: "#06C755" }}
          >
            用 LINE 綁定
          </button>
        </form>
        <p className="muted text-xs mt-4 text-center">
          連結 24 小時內有效、且只能使用一次
        </p>
      </div>
    </main>
  );
}
