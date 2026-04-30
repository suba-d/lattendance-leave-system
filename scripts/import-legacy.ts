/* eslint-disable no-console */
// Idempotent one-shot import from the legacy `leave_system` PostgreSQL dump.
//
// Reads `leave_system_dump.sql` from the repo root, parses the COPY blocks,
// and upserts users + leave_requests + leave_balances into the new schema.
// Re-runs are safe: every row is keyed on `legacyId`, so duplicate inserts
// are skipped.
//
// Run via:  pnpm tsx scripts/import-legacy.ts
// Or wired into amplify.yml after `prisma migrate deploy` + `seed`.
//
// Mapping decisions (see ImportPlan.md or the PR description):
//   - email: `${username.toLowerCase()}@appssp.com`
//   - name:  username (English) — kept as-is
//   - hireDate: 2024-01-01 placeholder; admin updates per-employee later
//   - passwordHash: null (LINE login is the canonical entry; SEED_ADMIN_*
//                   from env handles the recovery account separately)
//   - leave_type strings normalized to LeaveType.key
//   - half_day=t  → unit=HALF_DAY
//   - days × 8    → hours
//   - status     → ACTIVE (old "pending" is essentially ACTIVE in new schema)
//   - createdAt  → start_date - 1d (true submission timestamps lost in dump)
//   - LeaveBalance.totalHours = (used + remaining) × 8 so the displayed
//                  "remaining" in the new system equals the old DB.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, LeaveStatus, LeaveUnit, Prisma, Role } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";

// Use the Transaction pooler (DATABASE_URL) with pgbouncer + connection_limit
// flags so we don't compete with the runtime Lambda warm pool for Session
// pooler slots (only 15 on Supabase free tier).
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

const TZ = process.env.TZ || "Asia/Taipei";
const DUMP_PATH = join(process.cwd(), "leave_system_dump.sql");

const EMAIL_DOMAIN = "appssp.com";
const HIRE_DATE_PLACEHOLDER = new Date("2024-01-01T00:00:00.000Z");

const LEAVE_TYPE_KEY: Record<string, string> = {
  特休: "ANNUAL",
  vacation: "ANNUAL",
  病假: "SICK",
  sick: "SICK",
  事假: "PERSONAL",
  生理假: "MENSTRUAL",
  家庭照顧假: "FAMILY_CARE",
  同情假: "BEREAVEMENT",
};

const BALANCE_COL_TO_KEY: Record<string, string> = {
  vacation_days: "ANNUAL",
  sick_days: "SICK",
  personal_days: "PERSONAL",
  menstrual_days: "MENSTRUAL",
  family_care_days: "FAMILY_CARE",
  compassionate_days: "BEREAVEMENT",
};

// --- Postgres COPY text format helpers ---------------------------------------

function unescapeCopyValue(s: string): string | null {
  if (s === "\\N") return null;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      const n = s[++i];
      switch (n) {
        case "b": out += "\b"; break;
        case "f": out += "\f"; break;
        case "n": out += "\n"; break;
        case "r": out += "\r"; break;
        case "t": out += "\t"; break;
        case "v": out += "\v"; break;
        case "\\": out += "\\"; break;
        default: out += n;
      }
    } else {
      out += c;
    }
  }
  return out;
}

function parseCopyBlock(
  sql: string,
  tableName: string,
  columns: string[],
): Array<Record<string, string | null>> {
  // Match: COPY public."<name>" (...) FROM stdin;\n<rows>\n\.
  const re = new RegExp(
    `COPY\\s+public\\.(?:"${tableName}"|${tableName})\\s*\\([^)]*\\)\\s+FROM\\s+stdin;\\n([\\s\\S]*?)\\n\\\\\\.`,
    "m",
  );
  const m = sql.match(re);
  if (!m) return [];
  const block = m[1];
  const rows: Array<Record<string, string | null>> = [];
  for (const line of block.split("\n")) {
    if (!line) continue;
    const fields = line.split("\t");
    if (fields.length !== columns.length) {
      console.warn(`[parse] unexpected column count for ${tableName}: ${fields.length} vs ${columns.length}`);
      continue;
    }
    const row: Record<string, string | null> = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = unescapeCopyValue(fields[i]);
    }
    rows.push(row);
  }
  return rows;
}

// --- Import logic ------------------------------------------------------------

type LegacyUser = {
  id: number;
  username: string;
  is_admin: boolean;
  vacation_days: number;
  sick_days: number;
  personal_days: number;
  menstrual_days: number;
  family_care_days: number;
  compassionate_days: number;
};

type LegacyRecord = {
  id: number;
  user_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  reason: string | null;
  receipt_url: string | null;
  days: number;
};

async function importUsers(rows: LegacyUser[]) {
  let created = 0;
  let skipped = 0;
  for (const u of rows) {
    const email = `${u.username.toLowerCase()}@${EMAIL_DOMAIN}`;
    // Match by legacyId first; fall back to email so re-imports don't dup.
    const existing =
      (await prisma.user.findUnique({ where: { legacyId: u.id } })) ||
      (await prisma.user.findUnique({ where: { email } }));

    if (existing) {
      // Backfill legacyId only, leave the rest alone.
      if (existing.legacyId == null) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { legacyId: u.id },
        });
      }
      skipped++;
      continue;
    }
    await prisma.user.create({
      data: {
        legacyId: u.id,
        email,
        name: u.username,
        role: u.is_admin ? Role.ADMIN : Role.EMPLOYEE,
        hireDate: HIRE_DATE_PLACEHOLDER,
        passwordHash: null,
      },
    });
    created++;
  }
  console.log(`✓ users: created=${created} skipped=${skipped}`);
}

async function importLeaveBalances(users: LegacyUser[], records: LegacyRecord[]) {
  // Sum used hours per (user_id, key).
  const usedByKey = new Map<string, number>();
  for (const r of records) {
    const key = LEAVE_TYPE_KEY[r.leave_type];
    if (!key) continue;
    const k = `${r.user_id}|${key}`;
    usedByKey.set(k, (usedByKey.get(k) ?? 0) + r.days * 8);
  }

  const year = new Date().getFullYear();
  const leaveTypes = await prisma.leaveType.findMany();
  const typeByKey = new Map(leaveTypes.map((t) => [t.key, t]));

  let created = 0;
  let updated = 0;
  for (const u of users) {
    const dbUser = await prisma.user.findUnique({ where: { legacyId: u.id } });
    if (!dbUser) continue;

    for (const [col, key] of Object.entries(BALANCE_COL_TO_KEY)) {
      const remainingDays = (u as unknown as Record<string, number>)[col] ?? 0;
      const usedHours = usedByKey.get(`${u.id}|${key}`) ?? 0;
      const totalHours = remainingDays * 8 + usedHours;

      const lt = typeByKey.get(key);
      if (!lt) continue;

      const result = await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: dbUser.id,
            leaveTypeId: lt.id,
            year,
          },
        },
        update: { totalHours: new Prisma.Decimal(totalHours) },
        create: {
          userId: dbUser.id,
          leaveTypeId: lt.id,
          year,
          totalHours: new Prisma.Decimal(totalHours),
          notes: "imported from legacy DB",
        },
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
      else updated++;
    }
  }
  console.log(`✓ leave balances: created=${created} updated=${updated}`);
}

async function importLeaveRecords(records: LegacyRecord[]) {
  const userByLegacyId = new Map(
    (await prisma.user.findMany({ where: { legacyId: { not: null } } })).map(
      (u) => [u.legacyId!, u],
    ),
  );
  const typeByKey = new Map(
    (await prisma.leaveType.findMany()).map((t) => [t.key, t]),
  );

  let created = 0;
  let skipped = 0;
  let unmappedType = 0;
  let unmappedUser = 0;

  for (const r of records) {
    if (await prisma.leaveRequest.findUnique({ where: { legacyId: r.id } })) {
      skipped++;
      continue;
    }
    const user = userByLegacyId.get(r.user_id);
    if (!user) {
      unmappedUser++;
      continue;
    }
    const key = LEAVE_TYPE_KEY[r.leave_type];
    if (!key) {
      unmappedType++;
      continue;
    }
    const lt = typeByKey.get(key);
    if (!lt) {
      unmappedType++;
      continue;
    }

    const unit = r.half_day ? LeaveUnit.HALF_DAY : LeaveUnit.DAY;
    const startAt = fromZonedTime(`${r.start_date}T09:00:00`, TZ);
    const endAt = r.half_day
      ? fromZonedTime(`${r.end_date}T13:00:00`, TZ)
      : fromZonedTime(`${r.end_date}T18:00:00`, TZ);

    // Approximate the original submission time: one day before start.
    const createdAt = new Date(startAt);
    createdAt.setDate(createdAt.getDate() - 1);

    await prisma.leaveRequest.create({
      data: {
        legacyId: r.id,
        userId: user.id,
        leaveTypeId: lt.id,
        startAt,
        endAt,
        hours: new Prisma.Decimal(r.days * 8),
        unit,
        reason: r.reason,
        receiptUrl: r.receipt_url,
        status: LeaveStatus.ACTIVE,
        createdAt,
      },
    });
    created++;
  }
  console.log(
    `✓ leave records: created=${created} skipped=${skipped} unmappedType=${unmappedType} unmappedUser=${unmappedUser}`,
  );
}

async function main() {
  if (!existsSync(DUMP_PATH)) {
    console.log(`No ${DUMP_PATH} present — skipping legacy import.`);
    return;
  }
  console.log(`→ Importing from ${DUMP_PATH}`);
  const sql = readFileSync(DUMP_PATH, "utf8");

  const userRowsRaw = parseCopyBlock(sql, "user", [
    "id",
    "username",
    "password",
    "is_admin",
    "vacation_days",
    "sick_days",
    "personal_days",
    "menstrual_days",
    "family_care_days",
    "compassionate_days",
  ]);
  const recordRowsRaw = parseCopyBlock(sql, "leave_record", [
    "id",
    "user_id",
    "leave_type",
    "start_date",
    "end_date",
    "half_day",
    "reason",
    "receipt_url",
    "days",
    "status",
    "created_at",
    "updated_at",
  ]);

  console.log(`→ Parsed ${userRowsRaw.length} users, ${recordRowsRaw.length} leave records`);

  const users: LegacyUser[] = userRowsRaw.map((r) => ({
    id: parseInt(r.id!, 10),
    username: r.username!,
    is_admin: r.is_admin === "t",
    vacation_days: parseFloat(r.vacation_days ?? "0"),
    sick_days: parseFloat(r.sick_days ?? "0"),
    personal_days: parseFloat(r.personal_days ?? "0"),
    menstrual_days: parseFloat(r.menstrual_days ?? "0"),
    family_care_days: parseFloat(r.family_care_days ?? "0"),
    compassionate_days: parseFloat(r.compassionate_days ?? "0"),
  }));
  const records: LegacyRecord[] = recordRowsRaw.map((r) => ({
    id: parseInt(r.id!, 10),
    user_id: parseInt(r.user_id!, 10),
    leave_type: r.leave_type!,
    start_date: r.start_date!,
    end_date: r.end_date!,
    half_day: r.half_day === "t",
    reason: r.reason,
    receipt_url: r.receipt_url,
    days: parseFloat(r.days ?? "0"),
  }));

  await importUsers(users);
  await importLeaveBalances(users, records);
  await importLeaveRecords(records);
  console.log("✓ Legacy import complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
