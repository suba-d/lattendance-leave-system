import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Force `connection_limit=1` on the runtime URL. With Supabase pgbouncer
// (transaction mode at port 6543), Prisma's prepared statement caching
// collides with rotated connections under any kind of parallel query
// load (Promise.all in pages) and surfaces as
// "prepared statement \"s0\" already exists" (Postgres 42P05).
//
// Pinning the pool to a single connection sidesteps the entire class
// of bug regardless of which Supabase pooler mode the operator picked,
// at the cost of serializing the queries from a single Lambda instance
// — a non-issue for a 10-person internal app.
function ensureConnectionLimit(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "1");
    }
    return u.toString();
  } catch {
    return url;
  }
}

const runtimeUrl = ensureConnectionLimit(
  process.env.DIRECT_URL ?? process.env.DATABASE_URL,
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(runtimeUrl ? { datasources: { db: { url: runtimeUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
