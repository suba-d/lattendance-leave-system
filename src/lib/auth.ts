import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import LINE from "next-auth/providers/line";
import bcrypt from "bcryptjs";
import { inspect } from "node:util";
import { z } from "zod";
import { prisma } from "./db";
import { authConfig } from "./auth.config";
import { LINE_LOGIN_CHANNEL_ID, LINE_LOGIN_CHANNEL_SECRET, lineLoginEnabled } from "./env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "EMPLOYEE" | "ADMIN";
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const liffIdTokenSchema = z.object({
  idToken: z.string().min(1),
});

// Verifies a LIFF-issued LINE ID token via LINE's verify endpoint and returns
// the LINE userId. The endpoint validates signature + audience + expiry.
async function verifyLineIdToken(idToken: string): Promise<string | null> {
  if (!LINE_LOGIN_CHANNEL_ID) return null;
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: LINE_LOGIN_CHANNEL_ID,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { sub?: string };
  return data.sub ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Print every error detail to stderr → Amplify Function logs. The
  // default logger only emits the error name (e.g. "OAuthCallbackError"),
  // hiding the actual provider response that explains *why*. Use
  // util.inspect with depth:null so non-enumerable + nested cause
  // chains are dumped too.
  debug: !!process.env.AUTH_DEBUG,
  logger: {
    error(error) {
      console.error(
        "[auth][error]",
        inspect(error, { depth: null, getters: true, showHidden: false }),
      );
    },
    warn(code) {
      console.warn("[auth][warn]", code);
    },
    debug(code, metadata) {
      if (process.env.AUTH_DEBUG) {
        console.log("[auth][debug]", code, inspect(metadata, { depth: null }));
      }
    },
  },
  providers: [
    // Hidden fallback for emergencies (admin recovery, broken LINE binding).
    // The login page only exposes this when ?mode=email is set.
    Credentials({
      id: "credentials",
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.active || !user.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),

    // LIFF-issued ID token → User. Used by /api/auth/liff to mint a session.
    Credentials({
      id: "line-liff",
      name: "LIFF",
      credentials: { idToken: { type: "text" } },
      async authorize(raw) {
        const parsed = liffIdTokenSchema.safeParse(raw);
        if (!parsed.success) return null;
        const lineUserId = await verifyLineIdToken(parsed.data.idToken);
        if (!lineUserId) return null;
        const user = await prisma.user.findUnique({ where: { lineUserId } });
        if (!user || !user.active) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),

    // Standard LINE OAuth (web flow) — only registered if env vars set.
    //
    // Two cooperating workarounds for Auth.js v5 + LINE OIDC quirks:
    //
    //   1. checks: ["state", "nonce"] (no PKCE)
    //      Auth.js's PKCE handling for LINE produces an opaque
    //      OAuthCallbackError ("OAuth Provider returned an error") with
    //      no cause attached. Disabling PKCE round-trip lets the token
    //      exchange succeed, but in turn Auth.js stops auto-decoding
    //      the id_token JWT — so profile.sub becomes undefined.
    //
    //   2. Custom profile() that decodes tokens.id_token manually.
    //      Without this we'd fall back to Auth.js's randomUUID() for
    //      user.id, which then never matches the LINE sub stored at
    //      bind time and signIn returns line_unbound.
    //
    // Both arms verified locally with synthetic id_tokens; see git
    // history for the unit-test script.
    ...(lineLoginEnabled
      ? [
          LINE({
            clientId: LINE_LOGIN_CHANNEL_ID,
            clientSecret: LINE_LOGIN_CHANNEL_SECRET,
            checks: ["state", "nonce"],
            profile(profile, tokens) {
              let sub = (profile as { sub?: string })?.sub;
              if (!sub && typeof tokens?.id_token === "string") {
                try {
                  const parts = tokens.id_token.split(".");
                  if (parts.length >= 2 && parts[1]) {
                    const payload = JSON.parse(
                      Buffer.from(parts[1], "base64url").toString("utf-8"),
                    );
                    sub = payload.sub;
                  }
                } catch (e) {
                  console.error("[auth][line] id_token decode failed", e);
                }
              }
              const p = profile as {
                sub?: string;
                name?: string;
                picture?: string;
                email?: string;
              };
              return {
                id: sub ?? "",
                name: p?.name ?? null,
                image: p?.picture ?? null,
                email: p?.email ?? null,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "line") {
        // `user.id` from the LINE provider is the LINE userId.
        const lineUserId = user.id;
        console.log("[auth][line] login attempt", {
          lineUserIdFromAuth: lineUserId,
          lineUserIdLength: lineUserId?.length,
        });
        if (!lineUserId) return false;
        const matched = await prisma.user.findUnique({ where: { lineUserId } });
        if (!matched || !matched.active) {
          // Log every bound user so we can compare what's stored vs what
          // Auth.js extracted (case, length, prefix differences).
          const allBound = await prisma.user.findMany({
            where: { lineUserId: { not: null } },
            select: { id: true, email: true, lineUserId: true },
          });
          console.log("[auth][line] no match", {
            attemptedLineUserId: lineUserId,
            existingBindings: allBound,
          });
          // Reject and bounce to a friendly page.
          return "/login?error=line_unbound";
        }
        // Mutate the user so jwt() callback below stores OUR id, not LINE's.
        user.id = matched.id;
        (user as { role?: string }).role = matched.role;
        user.name = matched.name;
        user.email = matched.email;
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: "EMPLOYEE" | "ADMIN" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "EMPLOYEE" | "ADMIN";
      }
      return session;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
