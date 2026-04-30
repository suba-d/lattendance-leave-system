import Link from "next/link";

const REASONS: Record<string, string> = {
  not_found: "綁定 token 不存在或已被刪除",
  expired: "綁定連結已過期（24 小時上限）",
  used: "綁定連結已使用過",
  user_inactive: "對應的員工帳號已被停用",
  line_login_disabled: "伺服器尚未啟用 LINE Login（環境變數未設或拼錯）",
  no_origin: "無法判斷網址來源（APP_URL 未設）",
  oauth_error: "LINE 授權失敗（callback URL 可能未在 LINE Console 註冊）",
  state_mismatch: "防偽驗證失敗（cookie 沒帶回來，可能是瀏覽器設定）",
  token_exchange_failed: "向 LINE 換 access token 失敗（Channel secret 可能錯）",
  id_token_invalid: "LINE ID token 驗證失敗（Channel ID 可能錯）",
  conflict: "這個 LINE 帳號已綁定其他員工",
};

export default async function InvalidBindPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const sp = await searchParams;
  const reasonKey = sp?.reason || "";
  const reasonText = REASONS[reasonKey] || "";

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold mb-1">連結無效</h1>
        <p className="muted text-sm mb-4">
          這個綁定連結已過期、已使用或不存在。請聯絡管理員重新產生。
        </p>
        {reasonText ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm mb-4">
            <strong>原因：</strong> {reasonText}
            <div className="muted text-xs mt-1">
              代碼：<code className="font-mono">{reasonKey}</code>
            </div>
          </div>
        ) : null}
        <div className="flex gap-2">
          <Link href="/login" className="btn">回登入頁</Link>
          <a href="/api/healthz" className="btn" target="_blank" rel="noreferrer">
            診斷
          </a>
        </div>
      </div>
    </main>
  );
}
