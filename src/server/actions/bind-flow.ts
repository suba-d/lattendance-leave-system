"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { buildLineAuthorizeUrl } from "@/lib/line-oauth";
import { APP_URL, lineLoginEnabled } from "@/lib/env";
import { signBindState } from "@/lib/bind-state";

const STATE_COOKIE = "lattendance_bind_state";
const STATE_COOKIE_MAX_AGE = 10 * 60; // 10 minutes

function origin(): string {
  if (APP_URL) return APP_URL.replace(/\/$/, "");
  // Best-effort fallback when APP_URL not set.
  return "";
}

async function deriveOriginFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  return host ? `${proto}://${host}` : "";
}

export async function startBindAction(token: string): Promise<void> {
  if (!lineLoginEnabled) {
    redirect("/bind/invalid");
  }

  const invite = await prisma.lineBindInvite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    redirect("/bind/invalid");
  }

  const baseUrl = origin() || (await deriveOriginFromHeaders());
  if (!baseUrl) {
    throw new Error("Cannot determine app origin; set APP_URL env var");
  }

  const nonce = randomBytes(16).toString("base64url");
  const secret = process.env.AUTH_SECRET || "";
  const state = signBindState(token, nonce, secret);

  const c = await cookies();
  c.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE,
  });

  const authUrl = buildLineAuthorizeUrl({
    redirectUri: `${baseUrl}/api/line/bind/callback`,
    state,
    nonce,
  });
  redirect(authUrl);
}
