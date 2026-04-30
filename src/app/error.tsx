"use client";

// Global error boundary. Replaces Next.js's default opaque
// "Application error: a server-side exception has occurred" page with
// something that exposes the digest + lets the operator retry.
//
// Production strips the actual error message (security), so the digest
// is the most useful breadcrumb — it cross-references with the same
// hash inside Amplify Function logs / CloudWatch where the real stack
// trace lives.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold mb-2">系統暫時出錯</h1>
        <p className="muted text-sm mb-4">
          載入這個頁面時發生錯誤。可以先試試重新載入；若持續發生，把下面的代碼提供給管理員。
        </p>
        <div className="rounded border border-[var(--color-border)] bg-gray-50 p-3 text-xs space-y-1">
          <div>
            <span className="muted">類型：</span>
            <code className="font-mono">{error.name || "Error"}</code>
          </div>
          {error.digest ? (
            <div>
              <span className="muted">Digest：</span>
              <code className="font-mono select-all">{error.digest}</code>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={reset} className="btn btn-primary">
            重新載入
          </button>
          <a href="/api/healthz" className="btn" target="_blank" rel="noreferrer">
            診斷
          </a>
          <a href="/login" className="btn">
            回登入
          </a>
        </div>
      </div>
    </main>
  );
}
