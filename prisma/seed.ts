import { PrismaClient, LeaveCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const LEAVE_TYPES = [
  { key: "ANNUAL", name: "特別休假", category: LeaveCategory.ANNUAL, hasQuota: true, autoQuota: true, paid: true, sortOrder: 10 },
  { key: "SICK", name: "病假", category: LeaveCategory.SICK, hasQuota: true, autoQuota: false, paid: true, sortOrder: 20 },
  { key: "PERSONAL", name: "事假", category: LeaveCategory.PERSONAL, hasQuota: true, autoQuota: false, paid: false, sortOrder: 30 },
  { key: "MARRIAGE", name: "婚假", category: LeaveCategory.MARRIAGE, hasQuota: false, autoQuota: false, paid: true, sortOrder: 40 },
  { key: "BEREAVEMENT", name: "喪假", category: LeaveCategory.BEREAVEMENT, hasQuota: false, autoQuota: false, paid: true, sortOrder: 50 },
  { key: "MATERNITY", name: "產假", category: LeaveCategory.MATERNITY, hasQuota: false, autoQuota: false, paid: true, sortOrder: 60 },
  { key: "PATERNITY", name: "陪產(檢)假", category: LeaveCategory.PATERNITY, hasQuota: false, autoQuota: false, paid: true, sortOrder: 70 },
  { key: "MENSTRUAL", name: "生理假", category: LeaveCategory.MENSTRUAL, hasQuota: false, autoQuota: false, paid: true, sortOrder: 80 },
  { key: "FAMILY_CARE", name: "家庭照顧假", category: LeaveCategory.FAMILY_CARE, hasQuota: true, autoQuota: false, paid: true, sortOrder: 85 },
  { key: "OFFICIAL", name: "公假", category: LeaveCategory.OFFICIAL, hasQuota: false, autoQuota: false, paid: true, sortOrder: 90 },
  { key: "COMPENSATORY", name: "補休", category: LeaveCategory.COMPENSATORY, hasQuota: true, autoQuota: false, paid: true, sortOrder: 100 },
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
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN", active: true, name: adminName },
      create: {
        email: adminEmail,
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
