import path from "node:path";
import type { NextConfig } from "next";

// One .env for the whole monorepo lives at the repo root; scripts/link-env.mjs links it to web/.env.

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  // e2e builds use their own folder so they never clash with a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: path.resolve(process.cwd(), "..") },
  experimental: {
    // Next 16's on-disk Turbopack cache for `next dev` can restore a stale client chunk list, which
    // makes pages reload forever ("HMR hash mismatch"). Measured on this repo: 5/5 fresh starts looped
    // with it on. Production builds are unaffected.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
