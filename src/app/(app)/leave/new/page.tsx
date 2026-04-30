import { prisma } from "@/lib/db";
import { submitLeaveAction } from "@/server/actions/leave";

export default async function NewLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const types = await prisma.leaveType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">申請請假</h1>
      <p className="muted text-sm mb-6">送出後即生效，並自動同步到行事曆與通知群組</p>

      <form action={submitLeaveAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="leaveTypeId">假別</label>
          <select id="leaveTypeId" name="leaveTypeId" required className="input">
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="unit">時間單位</label>
          <select id="unit" name="unit" className="input" defaultValue="DAY">
            <option value="DAY">整天 (一天 8 小時)</option>
            <option value="HALF_DAY">半天 (4 小時)</option>
            <option value="HOUR">指定起訖時間</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="startAt">開始</label>
            <input
              id="startAt"
              name="startAt"
              type="datetime-local"
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="endAt">結束</label>
            <input
              id="endAt"
              name="endAt"
              type="datetime-local"
              required
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="reason">事由 (選填)</label>
          <textarea id="reason" name="reason" rows={3} className="input" />
        </div>

        {sp?.error ? <p className="text-sm text-red-600">{sp.error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">送出申請</button>
        </div>
      </form>
    </div>
  );
}
