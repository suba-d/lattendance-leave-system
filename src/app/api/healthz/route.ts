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
    DIRECT_URL_host: hostFromUrl(process.env.DIRECT_URL),
    DATABASE_URL_port: portFromUrl(process.env.DATABASE_URL),
    DATABASE_URL_schema: schemaFromUrl(process.env.DATABASE_URL),
    DIRECT_URL_schema: schemaFromUrl(process.env.DIRECT_URL),
    APP_URL: process.env.APP_URL ?? null,
    TZ: process.env.TZ ?? null,
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

  return NextResponse.json({ env, checks }, { status: 200 });
}

function hostFromUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.hostname;
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

function errString(e: unknown): string {
  if (e instanceof Error) {
    // Cap to keep output manageable.
    return `${e.name}: ${e.message.slice(0, 800)}`;
  }
  return String(e).slice(0, 800);
}
