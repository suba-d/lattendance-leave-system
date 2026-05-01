import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeLineCode, verifyLineIdToken } from "@/lib/line-oauth";
import { signIn } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { verifyOauthState } from "@/lib/bind-state";

const STATE_COOKIE = "lattendance_bind_state";

function originOf(req: NextRequest): string {
  if (APP_URL) return APP_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

function failBind(req: NextRequest, reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/bind/invalid?reason=${reason}`, req.url));
}

function failLogin(req: NextRequest, reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));
}

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // We don't know which mode (bind vs login) until we parse state, so when
  // OAuth itself errored upstream, default to /login since most users hit
  // that path. Bind users would have manually clicked an invite link, so
  // they at least see something usable.
  if (error || !code || !state) {
    return failLogin(req, "oauth_error");
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!cookieState || cookieState !== state) {
    return failLogin(req, "state_mismatch");
  }

  const verified = verifyOauthState(state, process.env.AUTH_SECRET || "");
  if (!verified) {
    return failLogin(req, "state_mismatch");
  }

  const tokens = await exchangeLineCode({
    code,
    redirectUri: `${originOf(req)}/api/line/bind/callback`,
  });
  if (!tokens) {
    return verified.mode === "bind"
      ? failBind(req, "token_exchange_failed")
      : failLogin(req, "token_exchange_failed");
  }

  const lineUserId = await verifyLineIdToken(tokens.idToken);
  if (!lineUserId) {
    return verified.mode === "bind"
      ? failBind(req, "id_token_invalid")
      : failLogin(req, "id_token_invalid");
  }

  // ---- LOGIN mode: just look up an already-bound user ------------------
  if (verified.mode === "login") {
    const user = await prisma.user.findUnique({ where: { lineUserId } });
    if (!user || !user.active) {
      return failLogin(req, "line_unbound");
    }
    await signIn("line-liff", {
      idToken: tokens.idToken,
      redirectTo: "/dashboard",
    });
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ---- BIND mode: bind invite + sign in --------------------------------
  const invite = await prisma.lineBindInvite.findUnique({
    where: { token: verified.token },
  });
  if (!invite) return failBind(req, "not_found");
  if (invite.usedAt) return failBind(req, "used");
  if (invite.expiresAt < new Date()) return failBind(req, "expired");

  const existing = await prisma.user.findUnique({ where: { lineUserId } });
  if (existing && existing.id !== invite.userId) {
    return failBind(req, "conflict");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: invite.userId }, data: { lineUserId } }),
    prisma.lineBindInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
  ]);

  await signIn("line-liff", {
    idToken: tokens.idToken,
    redirectTo: "/dashboard",
  });
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
