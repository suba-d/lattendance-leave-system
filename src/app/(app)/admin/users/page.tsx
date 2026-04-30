import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  activateUserAction,
  deactivateUserAction,
  upsertUserAction,
} from "@/server/actions/users";
import { createBindInviteAction, unbindLineAction } from "@/server/actions/bind";
import { APP_URL } from "@/lib/env";
import { headers } from "next/headers";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; invite?: string }>;
}) {
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  // Resolve a base URL we can show in the invite link banner.
  let baseUrl = APP_URL.replace(/\/$/, "");
  if (!baseUrl) {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    baseUrl = host ? `${proto}://${host}` : "";
  }
  const inviteUrl = sp?.invite ? `${baseUrl}/bind/${sp.invite}` : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">員工管理</h1>
      {sp?.saved ? <p className="text-sm text-green-600">✓ 已儲存</p> : null}
      {sp?.error ? <p className="text-sm text-red-600">{sp.error}</p> : null}

      {inviteUrl ? (
        <div className="card border-blue-300 bg-blue-50">
          <p className="text-sm font-medium mb-1">綁定連結已產生（24 小時內有效）</p>
          <p className="text-sm muted mb-2">把這個連結私訊給該員工：</p>
          <code className="block break-all text-xs bg-white p-2 rounded border border-blue-200">
            {inviteUrl}
          </code>
        </div>
      ) : null}

      <div className="card">
        <h2 className="font-semibold mb-3">新增員工</h2>
        <form action={upsertUserAction} className="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <label className="label" htmlFor="name">姓名</label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hireDate">到職日</label>
            <input id="hireDate" name="hireDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="role">角色</label>
            <select id="role" name="role" className="input">
              <option value={Role.EMPLOYEE}>員工</option>
              <option value={Role.ADMIN}>管理者</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="password">初始密碼</label>
            <input id="password" name="password" type="password" minLength={8} required className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary">新增</button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">所有員工</h2>
        <table className="w-full text-sm">
          <thead className="text-left muted border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2">姓名</th>
              <th className="py-2">Email</th>
              <th className="py-2">角色</th>
              <th className="py-2">到職日</th>
              <th className="py-2">狀態</th>
              <th className="py-2">LINE</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 align-top">
                <td className="py-2">{u.name}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">
                  <span className="badge">{u.role === "ADMIN" ? "管理者" : "員工"}</span>
                </td>
                <td className="py-2">{u.hireDate.toISOString().slice(0, 10)}</td>
                <td className="py-2">
                  {u.active ? (
                    <span className="badge badge-success">啟用</span>
                  ) : (
                    <span className="badge badge-muted">停用</span>
                  )}
                </td>
                <td className="py-2">
                  {u.lineUserId ? (
                    <div className="flex flex-col gap-1">
                      <span className="badge badge-success">已綁定</span>
                      <form action={unbindLineAction.bind(null, u.id)}>
                        <button className="btn text-xs" type="submit">解除綁定</button>
                      </form>
                    </div>
                  ) : (
                    <form action={createBindInviteAction.bind(null, u.id)}>
                      <button className="btn text-xs" type="submit">產生綁定連結</button>
                    </form>
                  )}
                </td>
                <td className="py-2">
                  <details>
                    <summary className="cursor-pointer text-blue-600">編輯</summary>
                    <form action={upsertUserAction} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        name="name"
                        defaultValue={u.name}
                        className="input"
                        placeholder="姓名"
                        required
                      />
                      <input
                        name="email"
                        type="email"
                        defaultValue={u.email}
                        className="input"
                        required
                      />
                      <input
                        name="hireDate"
                        type="date"
                        defaultValue={u.hireDate.toISOString().slice(0, 10)}
                        className="input"
                        required
                      />
                      <select name="role" defaultValue={u.role} className="input">
                        <option value={Role.EMPLOYEE}>員工</option>
                        <option value={Role.ADMIN}>管理者</option>
                      </select>
                      <label className="text-xs flex items-center gap-2">
                        <input type="checkbox" name="active" defaultChecked={u.active} /> 啟用
                      </label>
                      <input
                        name="password"
                        type="password"
                        placeholder="(可選) 重設密碼"
                        minLength={8}
                        className="input"
                      />
                      <button type="submit" className="btn btn-primary text-xs">儲存</button>
                    </form>
                    {u.active ? (
                      <form action={deactivateUserAction.bind(null, u.id)} className="mt-2">
                        <button type="submit" className="btn btn-danger text-xs">停用</button>
                      </form>
                    ) : (
                      <form action={activateUserAction.bind(null, u.id)} className="mt-2">
                        <button type="submit" className="btn text-xs">重新啟用</button>
                      </form>
                    )}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
