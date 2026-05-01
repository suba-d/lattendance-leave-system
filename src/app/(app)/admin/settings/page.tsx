import { headers } from "next/headers";
import {
  saveIpAllowlistAction,
  clearIpAllowlistAction,
} from "@/server/actions/settings";
import { getEffectiveAllowlist, extractClientIp } from "@/lib/ip-allowlist";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [rules, h] = await Promise.all([getEffectiveAllowlist(), headers()]);
  const myIp = extractClientIp(h);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">系統設定</h1>

      <div className="card">
        <h2 className="font-semibold">辦公室 IP 限制</h2>
        <p className="muted text-sm mt-1">
          設定後，員工只能從這些 IP / CIDR 範圍內打卡。空白 = 任何 IP 都能打卡（不建議正式環境）。
        </p>
        <p className="muted text-xs mt-1">
          支援 IPv4（含 CIDR，例 <code>203.0.113.0/24</code>）、IPv6（僅完整 IP，不含 CIDR）。
        </p>

        {sp?.saved ? <p className="text-sm text-green-600 mt-3">✓ 已儲存</p> : null}
        {sp?.error ? <p className="text-sm text-red-600 mt-3">{sp.error}</p> : null}

        <div className="mt-4 p-3 rounded bg-blue-50 border border-blue-200 text-sm">
          <strong>你目前的 IP：</strong>{" "}
          <code className="font-mono">{myIp ?? "（無法判斷）"}</code>
          {myIp ? (
            <p className="muted text-xs mt-1">
              在辦公室用這台機器打開設定頁時，這就是辦公室對外 IP。複製到下方欄位即可。
            </p>
          ) : null}
        </div>

        <form action={saveIpAllowlistAction} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="rules">允許的 IP / CIDR（一行一條，或用逗號分隔）</label>
            <textarea
              id="rules"
              name="rules"
              rows={5}
              className="input font-mono text-sm"
              defaultValue={rules.join("\n")}
              placeholder={`203.0.113.10\n198.51.100.0/24`}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">儲存</button>
            <button
              type="submit"
              formAction={clearIpAllowlistAction}
              className="btn"
              title="清空 = 停用 IP 限制"
            >
              全部清空
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 rounded bg-gray-50 border border-gray-200 text-xs">
          <p className="font-medium mb-1">目前生效：</p>
          {rules.length === 0 ? (
            <p className="text-amber-700">⚠️ 無 IP 限制（任何 IP 都能打卡）</p>
          ) : (
            <ul className="list-disc list-inside font-mono">
              {rules.map((r, i) => (
                <li key={`${r}-${i}`}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
