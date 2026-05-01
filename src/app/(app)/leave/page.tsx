import Link from "next/link";
import { LeaveStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";
import { cancelLeaveAction } from "@/server/actions/leave";
import ReceiptCell from "@/components/receipt-cell";

export default async function LeaveHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; canceled?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const sp = await searchParams;

  const items = await prisma.leaveRequest.findMany({
    where: { userId: session.user.id },
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
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">我的請假紀錄</h1>
        <Link href="/leave/new" className="btn btn-primary">+ 新增請假</Link>
      </div>

      {sp?.submitted ? <p className="text-sm text-green-600">✓ 申請已送出</p> : null}
      {sp?.canceled ? <p className="text-sm text-green-600">✓ 已取消</p> : null}
      {sp?.error ? <p className="text-sm text-red-600">{sp.error}</p> : null}

      {items.length === 0 ? (
        <div className="card text-center py-12 muted">尚無請假紀錄</div>
      ) : (
        <div className="card overflow-x-auto">
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
              {items.map((l) => (
                <tr key={l.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2"><span className="badge">{l.leaveType.name}</span></td>
                  <td className="py-2">
                    {formatDateTimeInOfficeTZ(l.startAt)}<br />
                    <span className="muted">~ {formatDateTimeInOfficeTZ(l.endAt)}</span>
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
                  <td className="py-2 text-right">
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
  );
}
