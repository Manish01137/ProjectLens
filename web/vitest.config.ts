import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    alias: { "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") },
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { LLM_PROVIDER: "none", ML_API_URL: "http://127.0.0.1:1" },
  },
});
