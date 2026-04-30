import Link from "next/link";
import { LeaveStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function AdminLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const filterUserId = sp?.userId || "";
  const filterStatus = sp?.status || "";

  const where: Prisma.LeaveRequestWhereInput = {};
  if (filterUserId) where.userId = filterUserId;
  if (filterStatus === "active") where.status = LeaveStatus.ACTIVE;
  if (filterStatus === "canceled") where.status = LeaveStatus.CANCELED;

  const [users, items] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { leaveType: true, user: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">所有請假紀錄</h1>

      <form className="card flex flex-wrap gap-3 items-end text-sm">
        <div>
          <label className="label" htmlFor="userId">員工</label>
          <select id="userId" name="userId" defaultValue={filterUserId} className="input">
            <option value="">全部</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">狀態</label>
          <select id="status" name="status" defaultValue={filterStatus} className="input">
            <option value="">全部</option>
            <option value="active">生效中</option>
            <option value="canceled">已取消</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">查詢</button>
        {(filterUserId || filterStatus) ? (
          <Link href="/admin/leave" className="btn">清除</Link>
        ) : null}
      </form>

      <div className="card overflow-x-auto">
        <p className="muted text-sm mb-2">共 {items.length} 筆（最多顯示 200 筆）</p>
        <table className="w-full text-sm">
          <thead className="text-left muted border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2">員工</th>
              <th className="py-2">假別</th>
              <th className="py-2">期間</th>
              <th className="py-2">時數</th>
              <th className="py-2">事由</th>
              <th className="py-2">狀態</th>
              <th className="py-2">同步</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-2">
                  <Link href={`/admin/users/${l.user.id}`} className="text-blue-600 hover:underline">
                    {l.user.name}
                  </Link>
                </td>
                <td className="py-2"><span className="badge">{l.leaveType.name}</span></td>
                <td className="py-2 text-xs">
                  {formatDateTimeInOfficeTZ(l.startAt)}<br />
                  ~ {formatDateTimeInOfficeTZ(l.endAt)}
                </td>
                <td className="py-2">{l.hours.toString()}</td>
                <td className="py-2 max-w-xs">
                  <div className="truncate">{l.reason ?? "—"}</div>
                  {l.receiptUrl ? (
                    <a
                      href={l.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      📎 單據
                    </a>
                  ) : null}
                </td>
                <td className="py-2">
                  {l.status === LeaveStatus.ACTIVE ? (
                    <span className="badge badge-success">生效中</span>
                  ) : (
                    <span className="badge badge-muted">已取消</span>
                  )}
                </td>
                <td className="py-2 text-xs muted">
                  {l.googleEventId ? "Cal ✓" : "Cal —"}{" "}
                  {l.lineNotifiedAt ? "/ LINE ✓" : "/ LINE —"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
