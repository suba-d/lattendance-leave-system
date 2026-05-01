/* eslint-disable no-console */
// One-off remediation for two Production data issues that snuck in earlier:
//
// (a) LeaveBalance.totalHours was inflated by adding the legacy "used" hours
//     on top of the legacy "remaining" — the dashboard's used aggregator only
//     counts current-year LeaveRequests, so legacy 2025 records were never
//     subtracted, leaving every employee with too much remaining (e.g. Ice's
//     特休 showed 16 instead of 6).
//
// (b) Five Taiwan-labor-law leave types (婚假 / 產假 / 陪產 / 公假 / 補休)
//     were seeded but the user's company doesn't use them. Remove if no
//     LeaveRequest references them; otherwise mark inactive.
//
// Idempotent on both fronts:
//   - Balance fix marks rows with notes="...corrected"; subsequent runs
//     detect that marker and skip.
//   - Leave type cleanup is naturally idempotent (delete or no-op).
//
// Wired into amplify.yml after seed + import so it runs on the next deploy
// without manual intervention.

import { PrismaClient } from "@prisma/client";

function flagged(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit"))
      u.searchParams.set("connection_limit", "1");
    if (u.port === "6543" && !u.searchParams.has("pgbouncer"))
      u.searchParams.set("pgbouncer", "true");
    return u.toString();
  } catch {
    return url;
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: flagged(process.env.DATABASE_URL ?? process.env.DIRECT_URL) },
  },
});

const KEYS_TO_REMOVE = [
  "MARRIAGE",
  "MATERNITY",
  "PATERNITY",
  "OFFICIAL",
  "COMPENSATORY",
];

const FIXED_NOTE = "imported from legacy DB (corrected 2026)";

async function fixInflatedBalances() {
  const balances = await prisma.leaveBalance.findMany({
    where: { notes: "imported from legacy DB" }, // un-corrected only
  });
  if (balances.length === 0) {
    console.log("✓ balances: no inflated rows to fix");
    return;
  }

  let fixed = 0;
  for (const b of balances) {
    const sum = await prisma.leaveRequest.aggregate({
      _sum: { hours: true },
      where: {
        userId: b.userId,
        leaveTypeId: b.leaveTypeId,
        legacyId: { not: null }, // only legacy-imported records
      },
    });
    const legacyUsedHours = Number(sum._sum.hours ?? 0);
    const oldTotal = Number(b.totalHours);
    const newTotal = Math.max(0, oldTotal - legacyUsedHours);

    await prisma.leaveBalance.update({
      where: { id: b.id },
      data: {
        totalHours: newTotal,
        notes: FIXED_NOTE,
      },
    });
    fixed++;
  }
  console.log(`✓ balances: corrected ${fixed} rows`);
}

async function removeUnusedLeaveTypes() {
  for (const key of KEYS_TO_REMOVE) {
    const lt = await prisma.leaveType.findUnique({ where: { key } });
    if (!lt) continue;

    const [reqCount, balCount] = await Promise.all([
      prisma.leaveRequest.count({ where: { leaveTypeId: lt.id } }),
      prisma.leaveBalance.count({ where: { leaveTypeId: lt.id } }),
    ]);

    if (reqCount === 0 && balCount === 0) {
      await prisma.leaveType.delete({ where: { id: lt.id } });
      console.log(`✓ leave type deleted: ${lt.name} (${key})`);
    } else {
      await prisma.leaveType.update({
        where: { id: lt.id },
        data: { active: false },
      });
      console.log(
        `⚠ leave type deactivated (still referenced): ${lt.name} (${key}) — requests=${reqCount} balances=${balCount}`,
      );
    }
  }
}

async function main() {
  console.log("→ Running legacy data remediation");
  await fixInflatedBalances();
  await removeUnusedLeaveTypes();
  console.log("✓ Done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
