import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// At runtime we want the Supabase Transaction pooler (port 6543) — it has
// a generous client limit (~200) compared to the Session pooler (15),
// which would saturate as Lambda warm pool grows.
//
// The Transaction pooler comes with two well-known Prisma footguns:
//   - It rotates backend connections per transaction, so prepared
//     statements named s0/s1/... collide across connections (42P05).
//   - Prisma's default prepared-statement caching trips this even on
//     simple parallel queries (Promise.all).
//
// Both are neutralized by adding two query params to the URL:
//   pgbouncer=true        → Prisma stops caching prepared statements
//   connection_limit=1    → Single shared connection per Lambda
//
// We inject them automatically so operators don't have to remember.
function ensureRuntimeFlags(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "1");
    }
    // Transaction pooler is identifiable by port 6543; if the operator
    // pointed DATABASE_URL at session/direct (5432), pgbouncer flag is
    // unnecessary and harmless to omit.
    if (u.port === "6543" && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Prefer DATABASE_URL (Transaction pooler) for runtime queries.
// DIRECT_URL (Session pooler) is reserved for prisma migrate deploy.
const runtimeUrl = ensureRuntimeFlags(
  process.env.DATABASE_URL ?? process.env.DIRECT_URL,
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
