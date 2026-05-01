import { prisma } from "@/lib/db";
import LeaveForm from "@/components/leave-form";

export default async function NewLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const types = await prisma.leaveType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, key: true },
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">申請請假</h1>
      <p className="muted text-sm mb-6">送出後即生效，並自動同步到行事曆與通知群組</p>

      <LeaveForm types={types} errorFromUrl={sp?.error} />
    </div>
  );
}
