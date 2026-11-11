#!/usr/bin/env node
// The monorepo keeps one .env at the repo root. Next.js and Prisma read web/.env, so link it.
// No-op when there is no root .env (Vercel, Docker and CI pass real environment variables).
import { existsSync, lstatSync, symlinkSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootEnv = path.join(web, "..", ".env");
const webEnv = path.join(web, ".env");
if (existsSync(rootEnv)) {
  let exists = false;
  try {
    lstatSync(webEnv);
    exists = true;
  } catch {}
  if (!exists) {
    try {
      symlinkSync("../.env", webEnv);
    } catch {
      copyFileSync(rootEnv, webEnv); // e.g. Windows without symlink rights
    }
  }
}
