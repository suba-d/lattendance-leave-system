import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Last 30 days of clock events.
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const events = await prisma.clockEvent.findMany({
    where: { userId: session.user.id, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
  });

  // Group by workDate.
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const k = e.workDate.toISOString().slice(0, 10);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(e);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">我的打卡紀錄</h1>
      <p className="muted text-sm">最近 30 天</p>

      {byDate.size === 0 ? (
        <div className="card text-center py-12 muted">尚無打卡紀錄</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted border-b border-[var(--color-border)]">
              <tr>
                <th className="py-2">日期</th>
                <th className="py-2">上班</th>
                <th className="py-2">下班</th>
                <th className="py-2">所有打卡</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byDate.entries()).map(([date, list]) => {
                const ordered = [...list].sort(
                  (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
                );
                const firstIn = ordered.find((e) => e.kind === "IN");
                const lastOut = [...ordered].reverse().find((e) => e.kind === "OUT");
                return (
                  <tr key={date} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2">{date}</td>
                    <td className="py-2">
                      {firstIn ? formatDateTimeInOfficeTZ(firstIn.occurredAt, "HH:mm") : "—"}
                    </td>
                    <td className="py-2">
                      {lastOut ? formatDateTimeInOfficeTZ(lastOut.occurredAt, "HH:mm") : "—"}
                    </td>
                    <td className="py-2">
                      {ordered
                        .map(
                          (e) =>
                            `${e.kind === "IN" ? "上" : "下"} ${formatDateTimeInOfficeTZ(e.occurredAt, "HH:mm")}`
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
  );
}
