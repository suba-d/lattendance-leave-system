import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = sp?.date || today;

  // We stored workDate as DATE in office TZ; query by exact match.
  const events = await prisma.clockEvent.findMany({
    where: {
      workDate: new Date(`${date}T00:00:00.000Z`),
    },
    orderBy: [{ userId: "asc" }, { occurredAt: "asc" }],
    include: { user: true },
  });

  // Group by user.
  const byUser = new Map<string, typeof events>();
  for (const e of events) {
    if (!byUser.has(e.userId)) byUser.set(e.userId, []);
    byUser.get(e.userId)!.push(e);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">每日打卡</h1>
        <form className="flex gap-2 items-center">
          <input type="date" name="date" defaultValue={date} className="input" />
          <button type="submit" className="btn">查詢</button>
        </form>
      </div>

      {byUser.size === 0 ? (
        <div className="card text-center py-12 muted">{date} 無打卡紀錄</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left muted border-b border-[var(--color-border)]">
              <tr>
                <th className="py-2">員工</th>
                <th className="py-2">上班</th>
                <th className="py-2">下班</th>
                <th className="py-2">所有打卡</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byUser.entries()).map(([userId, list]) => {
                const ordered = [...list].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
                const firstIn = ordered.find((e) => e.kind === "IN");
                const lastOut = [...ordered].reverse().find((e) => e.kind === "OUT");
                return (
                  <tr key={userId} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2">{ordered[0]?.user.name}</td>
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
