import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Protects every page except the landing and auth pages (see authConfig.callbacks.authorized).
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
