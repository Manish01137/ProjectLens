#!/usr/bin/env node
// Runs the Prisma CLI against SQLite (development) or PostgreSQL (deployment), chosen by DATABASE_URL.
// Prisma cannot read the provider from an env var, so for Postgres we write a copy of the schema
// with the provider swapped. The models themselves are identical for both databases.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(path.join(web, ".."));
nextEnv.loadEnvConfig(web);

const url = process.env.DATABASE_URL ?? "file:./dev.db";
process.env.DATABASE_URL = url;
let schema = path.join(web, "prisma", "schema.prisma");
if (/^postgres(ql)?:\/\//.test(url)) {
  const pg = readFileSync(schema, "utf8").replace('provider = "sqlite"', 'provider = "postgresql"');
  schema = path.join(web, "prisma", ".schema.postgres.prisma");
  writeFileSync(schema, pg);
}
const bin = path.join(web, "..", "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const r = spawnSync(bin, [...process.argv.slice(2), "--schema", schema], { stdio: "inherit", cwd: web, env: process.env });
process.exit(r.status ?? 1);
