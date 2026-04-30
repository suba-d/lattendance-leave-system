import Link from "next/link";

export default function InvalidBindPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">連結無效</h1>
        <p className="muted text-sm mb-4">
          這個綁定連結已過期、已使用或不存在。請聯絡管理員重新產生。
        </p>
        <Link href="/login" className="btn w-full">回登入頁</Link>
      </div>
    </main>
  );
}
