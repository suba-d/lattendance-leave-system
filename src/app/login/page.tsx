import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";
import { lineLoginEnabled } from "@/lib/env";
import { loginWithLineAction } from "@/server/actions/bind-flow";

async function emailLoginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").toLowerCase();
  const password = String(formData.get("password") || "");
  const from = String(formData.get("from") || "/dashboard");
  try {
    await signIn("credentials", { email, password, redirectTo: from || "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(`/login?mode=email&error=invalid&from=${encodeURIComponent(from)}`);
    }
    throw e;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string; mode?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const sp = await searchParams;
  const from = sp?.from || "/dashboard";
  const mode = sp?.mode === "email" ? "email" : "line";

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">登入</h1>
        <p className="muted text-sm mb-6">出勤與請假系統</p>

        {sp?.error === "line_unbound" ? (
          <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-300 text-sm">
            您的 LINE 帳號尚未綁定到員工帳號，請聯絡管理員索取綁定連結。
          </div>
        ) : null}
        {sp?.error === "oauth_error" ? (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-300 text-sm">
            LINE 授權失敗，請再試一次。
          </div>
        ) : null}
        {sp?.error === "state_mismatch" ? (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-300 text-sm">
            登入逾時或 cookie 異常，請重新嘗試。
          </div>
        ) : null}
        {sp?.error === "token_exchange_failed" || sp?.error === "id_token_invalid" ? (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-300 text-sm">
            LINE 驗證失敗（{sp.error}）。請聯絡管理員。
          </div>
        ) : null}

        {mode === "line" ? (
          <>
            <form action={loginWithLineAction}>
              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ background: "#06C755", borderColor: "#06C755" }}
                disabled={!lineLoginEnabled}
              >
                用 LINE 登入
              </button>
              {!lineLoginEnabled ? (
                <p className="muted text-xs mt-2">
                  LINE Login 尚未設定，請管理員配置環境變數。
                </p>
              ) : null}
            </form>
          </>
        ) : (
          <form action={emailLoginAction} className="space-y-4">
            <input type="hidden" name="from" value={from} />
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">密碼</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                autoComplete="current-password"
              />
            </div>
            {sp?.error === "invalid" ? (
              <p className="text-sm text-red-600">Email 或密碼錯誤</p>
            ) : null}
            <button type="submit" className="btn btn-primary w-full">登入</button>
            <p className="text-center">
              <Link href="/login" className="text-xs muted hover:underline">
                ← 改用 LINE 登入
              </Link>
            </p>
          </form>
        )}

        {mode === "line" ? (
          <p className="mt-6 text-center">
            <Link href="/login?mode=email" className="text-xs muted hover:underline">
              管理員救援登入
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
