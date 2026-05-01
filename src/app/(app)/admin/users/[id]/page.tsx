import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";
import { annualLeaveHoursAsOf } from "@/lib/leave-balance";
import { cancelLeaveAction } from "@/server/actions/leave";
import ReceiptCell from "@/components/receipt-cell";
import { workMillis, formatWorkHours } from "@/lib/work-hours";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const year = new Date().getFullYear();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      leaveBalances: {
        where: { year },
        include: { leaveType: true },
        orderBy: { leaveType: { sortOrder: "asc" } },
      },
    },
  });
  if (!user) notFound();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [leaveRequests, clockEvents, usedSums] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { userId: id },
      orderBy: { startAt: "desc" },
      take: 50,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        hours: true,
        unit: true,
        reason: true,
        receiptUrl: true,
        receiptMimeType: true,
        status: true,
        leaveType: { select: { name: true } },
        leaveTypeId: true,
      },
    }),
    prisma.clockEvent.findMany({
      where: { userId: id, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      _sum: { hours: true },
      where: {
        userId: id,
        status: LeaveStatus.ACTIVE,
        startAt: { gte: new Date(year, 0, 1) },
      },
    }),
  ]);

  const usedByType = new Map(
    usedSums.map((s) => [s.leaveTypeId, Number(s._sum.hours ?? 0)]),
  );

  // Group clock events by workDate.
  const clockByDate = new Map<string, typeof clockEvents>();
  for (const e of clockEvents) {
    const k = e.workDate.toISOString().slice(0, 10);
    if (!clockByDate.has(k)) clockByDate.set(k, []);
    clockByDate.get(k)!.push(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
          ← 員工列表
        </Link>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{user.name}</h1>
            <p className="muted text-sm">{user.email}</p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span className="badge">{user.role === "ADMIN" ? "管理者" : "員工"}</span>
            {user.active ? (
              <span className="badge badge-success">啟用</span>
            ) : (
              <span className="badge badge-muted">停用</span>
            )}
            {user.lineUserId ? (
              <span className="badge badge-success">LINE 已綁定</span>
            ) : (
              <span className="badge badge-muted">LINE 未綁定</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <Stat label="到職日" value={user.hireDate.toISOString().slice(0, 10)} />
          <Stat label="加入系統" value={user.createdAt.toISOString().slice(0, 10)} />
          {user.legacyId != null ? (
            <Stat label="舊系統 ID" value={`#${user.legacyId}`} />
          ) : null}
          <Stat
            label="特休依勞基法 §38"
            value={`${(annualLeaveHoursAsOf(user.hireDate, new Date()) / 8).toFixed(0)} 天`}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">{year} 年度假別餘額</h2>
        {user.leaveBalances.length === 0 ? (
          <p className="muted text-sm">沒有 {year} 年度的餘額紀錄</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left muted border-b border-[var(--color-border)]">
              <tr>
                <th className="py-2">假別</th>
                <th className="py-2">總額</th>
                <th className="py-2">已用</th>
                <th className="py-2">剩餘</th>
              </tr>
            </thead>
            <tbody>
              {user.leaveBalances.map((b) => {
                const total = Number(b.totalHours) + Number(b.adjustHours);
                const used = usedByType.get(b.leaveTypeId) ?? 0;
                const remain = Math.max(0, total - used);
                return (
                  <tr key={b.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2"><span className="badge">{b.leaveType.name}</span></td>
                    <td className="py-2">{(total / 8).toFixed(1)} 天</td>
                    <td className="py-2">{(used / 8).toFixed(1)} 天</td>
                    <td className="py-2 font-medium">{(remain / 8).toFixed(1)} 天</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">請假紀錄（最近 50 筆）</h2>
        {leaveRequests.length === 0 ? (
          <p className="muted text-sm">沒有請假紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left muted border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-2">假別</th>
                  <th className="py-2">期間</th>
                  <th className="py-2">時數</th>
                  <th className="py-2">事由</th>
                  <th className="py-2">收據</th>
                  <th className="py-2">狀態</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2"><span className="badge">{l.leaveType.name}</span></td>
                    <td className="py-2 text-xs">
                      {formatDateTimeInOfficeTZ(l.startAt)}<br />
                      ~ {formatDateTimeInOfficeTZ(l.endAt)}
                    </td>
                    <td className="py-2">{l.hours.toString()}</td>
                    <td className="py-2 max-w-xs">
                      <div className="truncate">{l.reason ?? "—"}</div>
                    </td>
                    <td className="py-2">
                      <ReceiptCell
                        leaveId={l.id}
                        hasBlob={!!l.receiptMimeType}
                        legacyUrl={l.receiptUrl}
                      />
                    </td>
                    <td className="py-2">
                      {l.status === LeaveStatus.ACTIVE ? (
                        <span className="badge badge-success">生效中</span>
                      ) : (
                        <span className="badge badge-muted">已取消</span>
                      )}
                    </td>
                    <td className="py-2">
                      {l.status === LeaveStatus.ACTIVE ? (
                        <form action={cancelLeaveAction.bind(null, l.id)}>
                          <button className="btn btn-danger text-xs">取消</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">打卡紀錄（最近 30 天）</h2>
        {clockByDate.size === 0 ? (
          <p className="muted text-sm">沒有打卡紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left muted border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-2">日期</th>
                  <th className="py-2">上班</th>
                  <th className="py-2">下班</th>
                  <th className="py-2">工時</th>
                  <th className="py-2">所有打卡</th>
                  <th className="py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(clockByDate.entries()).map(([date, list]) => {
                  const ordered = [...list].sort(
                    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
                  );
                  const firstIn = ordered.find((e) => e.kind === "IN");
                  const lastOut = [...ordered].reverse().find((e) => e.kind === "OUT");
                  const ms = workMillis(ordered);
                  return (
                    <tr key={date} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2">{date}</td>
                      <td className="py-2">
                        {firstIn ? formatDateTimeInOfficeTZ(firstIn.occurredAt, "HH:mm") : "—"}
                      </td>
                      <td className="py-2">
                        {lastOut ? formatDateTimeInOfficeTZ(lastOut.occurredAt, "HH:mm") : "—"}
                      </td>
                      <td className="py-2 font-medium">{formatWorkHours(ms)}</td>
                      <td className="py-2">
                        {ordered
                          .map(
                            (e) =>
                              `${e.kind === "IN" ? "上" : "下"} ${formatDateTimeInOfficeTZ(e.occurredAt, "HH:mm")}`,
                          )
                          .join(", ")}
                      </td>
                      <td className="py-2 muted text-xs">{ordered[0]?.ipAddress ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
