import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ, parseWorkDate, workDateString } from "@/lib/date";

export default async function AdminOverviewPage() {
  const today = workDateString();
  const workDate = parseWorkDate(today);

  const [employeeCount, todayClocks, leavesToday, recentLeaves] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.clockEvent.count({ where: { workDate } }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.ACTIVE,
        startAt: { lte: new Date(`${today}T23:59:59`) },
        endAt: { gte: new Date(`${today}T00:00:00`) },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { status: LeaveStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { leaveType: true, user: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">管理者總覽</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card">
          <div className="muted text-sm">在職員工</div>
          <div className="text-2xl font-semibold">{employeeCount}</div>
        </div>
        <div className="card">
          <div className="muted text-sm">今日打卡次數</div>
          <div className="text-2xl font-semibold">{todayClocks}</div>
        </div>
        <div className="card">
          <div className="muted text-sm">今日請假人數</div>
          <div className="text-2xl font-semibold">{leavesToday}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">最近申請</h2>
        {recentLeaves.length === 0 ? (
          <p className="text-sm muted">無資料</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {recentLeaves.map((l) => (
              <li key={l.id} className="py-2 text-sm flex justify-between">
                <div>
                  <strong>{l.user.name}</strong>{" "}
                  <span className="badge ml-1">{l.leaveType.name}</span>
                  <div className="muted text-xs">
                    {formatDateTimeInOfficeTZ(l.startAt)} ~ {formatDateTimeInOfficeTZ(l.endAt)}
                  </div>
                </div>
                <span className="muted">{l.hours.toString()} 小時</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
