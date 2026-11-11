import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fresh database for every run.
export default function globalSetup() {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  rmSync(path.join(web, "prisma", "e2e.db"), { force: true });
  execSync("node scripts/prisma.mjs db push --skip-generate", {
    cwd: web,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./e2e.db" },
  });
}
