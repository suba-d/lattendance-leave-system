import Link from "next/link";
import { LeaveStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClockCard } from "@/components/clock-card";
import { formatDateTimeInOfficeTZ, parseWorkDate, workDateString } from "@/lib/date";
import { annualLeaveHoursAsOf } from "@/lib/leave-balance";
import { ipAllowlistEnabled } from "@/lib/ip-allowlist";
import { googleCalendarEnabled, lineEnabled } from "@/lib/env";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = workDateString();
  const workDate = parseWorkDate(today);

  const [user, todayEvents, upcomingLeaves, usedAnnualLeave] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.clockEvent.findMany({
      where: { userId: session.user.id, workDate },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: LeaveStatus.ACTIVE,
        endAt: { gte: new Date() },
      },
      orderBy: { startAt: "asc" },
      take: 5,
      include: { leaveType: true },
    }),
    prisma.leaveRequest.aggregate({
      _sum: { hours: true },
      where: {
        userId: session.user.id,
        status: LeaveStatus.ACTIVE,
        leaveType: { key: "ANNUAL" },
        startAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
    }),
  ]);

  const firstIn = todayEvents.find((e) => e.kind === "IN");
  const lastOut = [...todayEvents].reverse().find((e) => e.kind === "OUT");

  const annualEntitlement = user
    ? annualLeaveHoursAsOf(user.hireDate, new Date())
    : 0;
  const usedHours = Number(usedAnnualLeave._sum.hours ?? 0);
  const remaining = Math.max(0, annualEntitlement - usedHours);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">早安，{session.user.name}</h1>
        <p className="muted text-sm">{today}</p>
      </div>

      {!ipAllowlistEnabled() ? (
        <div className="card border-amber-300 bg-amber-50">
          <p className="text-sm">
            ⚠️ <strong>OFFICE_IP_ALLOWLIST</strong> 未設定，目前任何 IP 都能打卡。
            正式環境請設定辦公室 IP。
          </p>
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        <ClockCard
          lastIn={firstIn ? formatDateTimeInOfficeTZ(firstIn.occurredAt, "HH:mm") : null}
          lastOut={lastOut ? formatDateTimeInOfficeTZ(lastOut.occurredAt, "HH:mm") : null}
        />

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">特休餘額</h2>
            <Link href="/leave/new" className="text-sm text-blue-600 hover:underline">
              我要請假 →
            </Link>
          </div>
          <p className="text-3xl font-semibold">
            {(remaining / 8).toFixed(1)} <span className="text-base muted">天</span>
          </p>
          <p className="text-sm muted mt-1">
            年度配額 {(annualEntitlement / 8).toFixed(0)} 天 / 已使用 {(usedHours / 8).toFixed(1)} 天
          </p>
          <p className="text-xs muted mt-3">
            依勞基法 §38 按到職日 {user ? user.hireDate.toISOString().slice(0, 10) : "—"} 自動計算
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">即將到來的請假</h2>
          <Link href="/leave" className="text-sm text-blue-600 hover:underline">
            全部紀錄 →
          </Link>
        </div>
        {upcomingLeaves.length === 0 ? (
          <p className="text-sm muted">沒有即將到來的請假</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {upcomingLeaves.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="badge mr-2">{l.leaveType.name}</span>
                  <span>
                    {formatDateTimeInOfficeTZ(l.startAt)} ~ {formatDateTimeInOfficeTZ(l.endAt)}
                  </span>
                </div>
                <span className="muted">{l.hours.toString()} 小時</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">系統整合狀態</h2>
        <ul className="text-sm space-y-1">
          <li>
            Google Calendar 同步：
            {googleCalendarEnabled ? (
              <span className="badge badge-success ml-2">已啟用</span>
            ) : (
              <span className="badge badge-muted ml-2">未設定</span>
            )}
          </li>
          <li>
            LINE 群組通知：
            {lineEnabled ? (
              <span className="badge badge-success ml-2">已啟用</span>
            ) : (
              <span className="badge badge-muted ml-2">未設定</span>
            )}
          </li>
          <li>
            辦公室 IP 限制：
            {ipAllowlistEnabled() ? (
              <span className="badge badge-success ml-2">已啟用</span>
            ) : (
              <span className="badge badge-danger ml-2">未啟用</span>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
