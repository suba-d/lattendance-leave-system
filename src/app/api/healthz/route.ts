import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Diagnostic endpoint. Returns env / DB / migration state so deployment
// problems can be inspected from the browser without digging through
// CloudWatch. SAFE to expose: leaks no secret values, only booleans /
// counts / sanitized error messages.
export async function GET() {
  const env = {
    NODE_ENV: process.env.NODE_ENV ?? null,
    has_AUTH_SECRET: !!process.env.AUTH_SECRET,
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_DIRECT_URL: !!process.env.DIRECT_URL,
    DATABASE_URL_host: hostFromUrl(process.env.DATABASE_URL),
    DATABASE_URL_port: portFromUrl(process.env.DATABASE_URL),
    DATABASE_URL_schema: schemaFromUrl(process.env.DATABASE_URL),
    DATABASE_URL_pgbouncer: hasParam(process.env.DATABASE_URL, "pgbouncer"),
    DATABASE_URL_connection_limit: paramValue(process.env.DATABASE_URL, "connection_limit"),
    DIRECT_URL_host: hostFromUrl(process.env.DIRECT_URL),
    DIRECT_URL_port: portFromUrl(process.env.DIRECT_URL),
    DIRECT_URL_schema: schemaFromUrl(process.env.DIRECT_URL),
    APP_URL: process.env.APP_URL ?? null,
    TZ_raw: process.env.TZ ?? null,
    // LINE integration env state — booleans only, no secret values.
    has_LINE_LOGIN_CHANNEL_ID: !!process.env.LINE_LOGIN_CHANNEL_ID,
    has_LINE_LOGIN_CHANNEL_SECRET: !!process.env.LINE_LOGIN_CHANNEL_SECRET,
    has_LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    has_LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
    has_LINE_CHANNEL_ID: !!process.env.LINE_CHANNEL_ID,
    has_NEXT_PUBLIC_LIFF_ID: !!process.env.NEXT_PUBLIC_LIFF_ID,
  };

  const checks: Record<string, unknown> = {};

  try {
    const start = Date.now();
    await prisma.$queryRawUnsafe<Array<{ ok: number }>>("SELECT 1 as ok");
    checks.db_ping_ms = Date.now() - start;
  } catch (e) {
    checks.db_ping_error = errString(e);
  }

  try {
    checks.user_count = await prisma.user.count();
  } catch (e) {
    checks.user_count_error = errString(e);
  }

  try {
    checks.leave_type_count = await prisma.leaveType.count();
  } catch (e) {
    checks.leave_type_count_error = errString(e);
  }

  try {
    checks.leave_request_count = await prisma.leaveRequest.count();
  } catch (e) {
    checks.leave_request_count_error = errString(e);
  }

  // Concurrent query check — reproduces what dashboard does (Promise.all).
  // If this fails with "prepared statement already exists" while the
  // sequential checks above succeed, you're hitting the pgbouncer
  // collision bug — fix is connection_limit=1 (already enforced by
  // src/lib/db.ts) or use the session pooler.
  try {
    const start = Date.now();
    const [u, lt, lr, ce] = await Promise.all([
      prisma.user.count(),
      prisma.leaveType.count(),
      prisma.leaveRequest.count(),
      prisma.clockEvent.count(),
    ]);
    checks.parallel_ok = { ms: Date.now() - start, u, lt, lr, ce };
  } catch (e) {
    checks.parallel_error = errString(e);
  }

  return NextResponse.json({ env, checks }, { status: 200 });
}

function hostFromUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).hostname;
  } catch {
    return "INVALID";
  }
}

function portFromUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).port || null;
  } catch {
    return "INVALID";
  }
}

function schemaFromUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).searchParams.get("schema");
  } catch {
    return "INVALID";
  }
}

function hasParam(u: string | null | undefined, key: string): boolean | null {
  if (!u) return null;
  try {
    return new URL(u).searchParams.has(key);
  } catch {
    return null;
  }
}

function paramValue(u: string | null | undefined, key: string): string | null {
  if (!u) return null;
  try {
    return new URL(u).searchParams.get(key);
  } catch {
    return null;
  }
}

function errString(e: unknown): string {
  if (e instanceof Error) {
    return `${e.name}: ${e.message.slice(0, 800)}`;
  }
  return String(e).slice(0, 800);
}
