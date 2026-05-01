import { PrismaClient, LeaveCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

// Use the Transaction pooler (DATABASE_URL) with pgbouncer + connection_limit
// flags injected; the Session pooler (DIRECT_URL) only has 15 client slots
// which compete with the runtime Lambda warm pool and lock up under repeat
// deploys. Schema migrations still use DIRECT_URL via schema.prisma.
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

// The six leave types actually present in the legacy system. Other Taiwan
// labor-law categories (婚假 / 產假 / 陪產 / 公假 / 補休) are deliberately
// NOT seeded — operator can add them later if business policy needs them.
const LEAVE_TYPES = [
  { key: "ANNUAL", name: "特別休假", category: LeaveCategory.ANNUAL, hasQuota: true, autoQuota: true, paid: true, sortOrder: 10 },
  { key: "SICK", name: "病假", category: LeaveCategory.SICK, hasQuota: true, autoQuota: false, paid: true, sortOrder: 20 },
  { key: "PERSONAL", name: "事假", category: LeaveCategory.PERSONAL, hasQuota: true, autoQuota: false, paid: false, sortOrder: 30 },
  { key: "BEREAVEMENT", name: "喪假", category: LeaveCategory.BEREAVEMENT, hasQuota: false, autoQuota: false, paid: true, sortOrder: 50 },
  { key: "MENSTRUAL", name: "生理假", category: LeaveCategory.MENSTRUAL, hasQuota: false, autoQuota: false, paid: true, sortOrder: 80 },
  { key: "FAMILY_CARE", name: "家庭照顧假", category: LeaveCategory.FAMILY_CARE, hasQuota: true, autoQuota: false, paid: true, sortOrder: 85 },
];

async function main() {
  for (const lt of LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { key: lt.key },
      update: {
        name: lt.name,
        category: lt.category,
        hasQuota: lt.hasQuota,
        autoQuota: lt.autoQuota,
        paid: lt.paid,
        sortOrder: lt.sortOrder,
      },
      create: lt,
    });
  }
  console.log(`Seeded ${LEAVE_TYPES.length} leave types.`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || "Admin";

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const normalizedEmail = adminEmail.toLowerCase();
    const admin = await prisma.user.upsert({
      where: { email: normalizedEmail },
      // Always reset name + role + password from the env on every deploy so
      // operators can recover the recovery account by re-deploying with a
      // new SEED_ADMIN_PASSWORD.
      update: {
        role: "ADMIN",
        active: true,
        name: adminName,
        passwordHash,
      },
      create: {
        email: normalizedEmail,
        name: adminName,
        passwordHash,
        role: "ADMIN",
        hireDate: new Date(),
      },
    });
    console.log(`Seeded admin user: ${admin.email}`);
  } else {
    console.log("SEED_ADMIN_EMAIL/PASSWORD not set; skipping admin seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
