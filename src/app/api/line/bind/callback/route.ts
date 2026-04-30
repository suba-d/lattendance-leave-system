import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeLineCode, verifyLineIdToken } from "@/lib/line-oauth";
import { signIn } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { verifyBindState } from "@/lib/bind-state";

const STATE_COOKIE = "lattendance_bind_state";

function originOf(req: NextRequest): string {
  if (APP_URL) return APP_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

function fail(req: NextRequest, reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/bind/invalid?reason=${reason}`, req.url));
}

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return fail(req, "oauth_error");
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!cookieState || cookieState !== state) {
    return fail(req, "state_mismatch");
  }

  const verified = verifyBindState(state, process.env.AUTH_SECRET || "");
  if (!verified) {
    return fail(req, "state_mismatch");
  }

  const invite = await prisma.lineBindInvite.findUnique({
    where: { token: verified.token },
  });
  if (!invite) return fail(req, "not_found");
  if (invite.usedAt) return fail(req, "used");
  if (invite.expiresAt < new Date()) return fail(req, "expired");

  const tokens = await exchangeLineCode({
    code,
    redirectUri: `${originOf(req)}/api/line/bind/callback`,
  });
  if (!tokens) return fail(req, "token_exchange_failed");

  const lineUserId = await verifyLineIdToken(tokens.idToken);
  if (!lineUserId) return fail(req, "id_token_invalid");

  // Reject if this LINE userId is already bound to a different employee.
  const existing = await prisma.user.findUnique({ where: { lineUserId } });
  if (existing && existing.id !== invite.userId) {
    return fail(req, "conflict");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: invite.userId },
      data: { lineUserId },
    }),
    prisma.lineBindInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Mint an Auth.js session via the LIFF credentials provider, which verifies
  // the same id_token and looks up the (now-bound) user.
  await signIn("line-liff", {
    idToken: tokens.idToken,
    redirectTo: "/dashboard",
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
