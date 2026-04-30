"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Loads the LIFF SDK from CDN at runtime (no npm dep). Idempotent: safe to
// call multiple times during dev hot-reload.
function loadLiffSdk(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { liff?: unknown };
  if (w.liff) return Promise.resolve(w.liff);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => resolve((window as unknown as { liff: unknown }).liff);
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

type LiffSdk = {
  init(c: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(c?: { redirectUri?: string }): void;
  getIDToken(): string | null;
  isInClient(): boolean;
};

export default function LiffBootstrap({
  liffId,
  forwardTo,
}: {
  liffId: string;
  forwardTo: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!liffId) {
      setError("尚未設定 LIFF_ID");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sdk = (await loadLiffSdk()) as LiffSdk;
        await sdk.init({ liffId });
        if (cancelled) return;

        if (!sdk.isLoggedIn()) {
          // Triggers LINE login (in-app silent or web flow).
          sdk.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = sdk.getIDToken();
        if (!idToken) {
          setError("無法取得 LINE ID token");
          return;
        }

        // Exchange ID token for an Auth.js session via the line-liff provider.
        const res = await fetch("/api/auth/callback/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            idToken,
            csrfToken: await getCsrfToken(),
            callbackUrl: forwardTo,
          }),
        });
        if (!res.ok) {
          setError("登入失敗：員工帳號可能尚未綁定 LINE");
          return;
        }
        // Auth.js redirects on success; if we got here without redirect, push.
        router.replace(forwardTo);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "LIFF 初始化失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liffId, forwardTo, router]);

  if (error) {
    return (
      <div className="mt-4 p-3 rounded bg-red-50 border border-red-300 text-sm text-left">
        <strong>登入失敗：</strong> {error}
        <p className="muted text-xs mt-1">請聯絡管理員確認帳號綁定狀態。</p>
      </div>
    );
  }
  return null;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf");
  const data = (await res.json()) as { csrfToken?: string };
  return data.csrfToken ?? "";
}
