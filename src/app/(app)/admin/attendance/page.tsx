import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; userId?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = sp?.date || today;
  const userId = sp?.userId || "";

  const where: Prisma.ClockEventWhereInput = {
    workDate: new Date(`${date}T00:00:00.000Z`),
  };
  if (userId) where.userId = userId;

  const [users, events] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.clockEvent.findMany({
      where,
      orderBy: [{ userId: "asc" }, { occurredAt: "asc" }],
      include: { user: true },
    }),
  ]);

  // Group by user.
  const byUser = new Map<string, typeof events>();
  for (const e of events) {
    if (!byUser.has(e.userId)) byUser.set(e.userId, []);
    byUser.get(e.userId)!.push(e);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">每日打卡</h1>

      <form className="card flex flex-wrap gap-3 items-end text-sm">
        <div>
          <label className="label" htmlFor="date">日期</label>
          <input id="date" type="date" name="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="userId">員工</label>
          <select id="userId" name="userId" defaultValue={userId} className="input">
            <option value="">全部</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">查詢</button>
        {userId ? (
          <Link href={`/admin/attendance?date=${date}`} className="btn">清除員工篩選</Link>
        ) : null}
      </form>

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
              {Array.from(byUser.entries()).map(([uid, list]) => {
                const ordered = [...list].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
                const firstIn = ordered.find((e) => e.kind === "IN");
                const lastOut = [...ordered].reverse().find((e) => e.kind === "OUT");
                return (
                  <tr key={uid} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2">
                      <Link href={`/admin/users/${uid}`} className="text-blue-600 hover:underline">
                        {ordered[0]?.user.name}
                      </Link>
                    </td>
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
  );
}
