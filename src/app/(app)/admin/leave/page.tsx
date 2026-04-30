import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";

export default async function AdminLeavePage() {
  const items = await prisma.leaveRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { leaveType: true, user: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">所有請假紀錄</h1>
      <div className="card overflow-x-auto">
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
                <td className="py-2">{l.user.name}</td>
                <td className="py-2"><span className="badge">{l.leaveType.name}</span></td>
                <td className="py-2 text-xs">
                  {formatDateTimeInOfficeTZ(l.startAt)}<br />
                  ~ {formatDateTimeInOfficeTZ(l.endAt)}
                </td>
                <td className="py-2">{l.hours.toString()}</td>
                <td className="py-2 max-w-xs truncate">{l.reason ?? "—"}</td>
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
