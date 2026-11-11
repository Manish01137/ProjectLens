import type { NextAuthConfig } from "next-auth";

const PUBLIC_PAGES = ["/", "/login", "/signup"];
const AUTH_PAGES = ["/login", "/signup"];

/** Edge-safe part of the auth config (no database), shared by proxy.ts and auth.ts. */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const loggedIn = Boolean(auth?.user);
      // API routes check the session themselves and answer 401 JSON instead of redirecting.
      if (pathname.startsWith("/api/")) return true;
      if (AUTH_PAGES.includes(pathname) && loggedIn) return Response.redirect(new URL("/chat", request.nextUrl));
      if (PUBLIC_PAGES.includes(pathname)) return true;
      return loggedIn; // false → redirect to /login?callbackUrl=...
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
