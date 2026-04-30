import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").toLowerCase();
  const password = String(formData.get("password") || "");
  const from = String(formData.get("from") || "/dashboard");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: from || "/dashboard",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(`/login?error=invalid&from=${encodeURIComponent(from)}`);
    }
    throw e;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const sp = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">登入</h1>
        <p className="muted text-sm mb-6">出勤與請假系統</p>
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="from" value={sp?.from || "/dashboard"} />
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              密碼
            </label>
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
          <button type="submit" className="btn btn-primary w-full">
            登入
          </button>
        </form>
      </div>
    </main>
  );
}
