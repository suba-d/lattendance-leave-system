import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTimeInOfficeTZ, parseWorkDate, workDateString } from "@/lib/date";
import { ipAllowlistEnabled } from "@/lib/ip-allowlist";
import ClockButtons from "@/components/clock-buttons";

export const dynamic = "force-dynamic";

// Standalone, mobile-first clock-in page. Designed for the LINE Rich Menu
// "打卡" button: opens via LIFF → /clock loads, big tap targets, minimal
// chrome.
export default async function ClockPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = workDateString();
  const workDate = parseWorkDate(today);

  const [events, ipEnabled] = await Promise.all([
    prisma.clockEvent.findMany({
      where: { userId: session.user.id, workDate },
      orderBy: { occurredAt: "asc" },
    }),
    ipAllowlistEnabled(),
  ]);

  const firstIn = events.find((e) => e.kind === "IN");
  const lastOut = [...events].reverse().find((e) => e.kind === "OUT");

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">打卡</h1>
        <p className="muted text-sm">{today} · {session.user.name}</p>
      </div>

      {!ipEnabled ? (
        <div className="card border-amber-300 bg-amber-50 text-sm">
          ⚠️ 目前無 IP 限制，任何網路都能打卡
        </div>
      ) : null}

      <div className="card">
        <h2 className="font-semibold mb-3 text-center">今日紀錄</h2>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="muted text-xs">上班</div>
            <div className="font-semibold text-2xl">
              {firstIn ? formatDateTimeInOfficeTZ(firstIn.occurredAt, "HH:mm") : "—"}
            </div>
          </div>
          <div>
            <div className="muted text-xs">下班</div>
            <div className="font-semibold text-2xl">
              {lastOut ? formatDateTimeInOfficeTZ(lastOut.occurredAt, "HH:mm") : "—"}
            </div>
          </div>
        </div>
      </div>

      <ClockButtons />

      {events.length > 1 ? (
        <details className="card">
          <summary className="cursor-pointer text-sm muted">所有打卡紀錄</summary>
          <ul className="mt-2 text-sm space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span className="font-medium">
                  {e.kind === "IN" ? "🟢 上班" : "🔴 下班"}
                </span>
                <span className="muted">
                  {formatDateTimeInOfficeTZ(e.occurredAt, "HH:mm:ss")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
