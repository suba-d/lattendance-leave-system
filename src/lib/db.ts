import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prefer DIRECT_URL (session pooler / direct) at runtime. Supabase's
// transaction pooler at port 6543 collides with Prisma's prepared
// statement caching across rotated connections, surfacing as
// "prepared statement \"s0\" already exists" (Postgres 42P05) under
// any sustained query load. Session pooler holds the connection for
// the lifetime of the client, which avoids the collision entirely.
// For a small internal app the connection-count tradeoff is irrelevant.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
