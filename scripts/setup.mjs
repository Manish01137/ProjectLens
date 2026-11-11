#!/usr/bin/env node
// One-time setup: .env with fresh secrets, Node deps, Python venv, database + demo seed.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, opts = {}) => {
  console.log(`\n› ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
};

const envPath = join(root, ".env");
if (!existsSync(envPath)) {
  let env = readFileSync(join(root, ".env.example"), "utf8");
  env = env
    .replace('AUTH_SECRET=""', `AUTH_SECRET="${randomBytes(32).toString("base64")}"`)
    .replace('ML_ADMIN_TOKEN=""', `ML_ADMIN_TOKEN="${randomBytes(24).toString("hex")}"`);
  writeFileSync(envPath, env);
  console.log("Created .env with a fresh AUTH_SECRET and ML_ADMIN_TOKEN.");
} else {
  console.log(".env already exists, leaving it as is.");
}

run("npm install");
run("node scripts/ml.mjs install");
run("npm --workspace web run db:setup");
console.log("\nSetup complete. Start everything with: npm run dev");
