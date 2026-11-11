import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run a production build against the mock ML service (e2e/mock-ml.mjs)
// and a throwaway SQLite database, so they need neither the trained model nor an LLM.
const PORT = 3100;
const ML_PORT = 8101;
const env = {
  DATABASE_URL: "file:./e2e.db",
  ML_API_URL: `http://127.0.0.1:${ML_PORT}`,
  LLM_PROVIDER: "none",
  AUTH_SECRET: "e2e-secret-not-for-production-0123456789",
  AUTH_URL: `http://localhost:${PORT}`,
  AUTH_GOOGLE_ID: "",
  AUTH_GOOGLE_SECRET: "",
  NEXT_DIST_DIR: ".next-e2e",
  PORT: String(PORT),
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node e2e/mock-ml.mjs ${ML_PORT}`,
      url: `http://127.0.0.1:${ML_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      command: `npx next build && npx next start --port ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      timeout: 300_000,
      reuseExistingServer: false,
      env,
    },
  ],
});
