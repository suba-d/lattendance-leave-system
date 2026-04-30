import LiffBootstrap from "@/components/liff-bootstrap";
import { NEXT_PUBLIC_LIFF_ID } from "@/lib/env";

export const dynamic = "force-dynamic";

// Single LIFF entry point. Bootstraps LIFF SDK in the browser, completes the
// LINE login flow inside the LINE in-app webview, exchanges the ID token for
// an Auth.js session, then forwards to the requested page.
export default async function LiffEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const sp = await searchParams;
  const to = sp?.to || "/dashboard";

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-2">正在登入…</h1>
        <p className="muted text-sm">透過 LINE 自動登入中，請稍候。</p>
        <LiffBootstrap liffId={NEXT_PUBLIC_LIFF_ID} forwardTo={to} />
      </div>
    </main>
  );
}
