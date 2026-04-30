import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB / bcrypt). Imported by middleware.
// Provider is added in src/lib/auth.ts which is server-only.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Required when running behind a reverse proxy / CDN (Amplify, Vercel,
  // Cloudflare). Without this, NextAuth v5 returns
  // "There was a problem with the server configuration." because the host
  // header from the proxy doesn't match its strict default policy.
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isLoginRoute = path === "/login";
      const isPublic =
        path.startsWith("/bind") ||
        path.startsWith("/liff") ||
        path.startsWith("/api/line");

      if (isPublic) return true;
      if (isLoginRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }
      if (!isLoggedIn) {
        const url = new URL("/login", request.nextUrl);
        if (path !== "/") url.searchParams.set("from", path);
        return Response.redirect(url);
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
} satisfies NextAuthConfig;
