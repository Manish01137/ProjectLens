import "server-only";
import { z } from "zod";

const optional = z.string().trim().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "required"),
  AUTH_SECRET: z.string().min(16, "required (at least 16 characters)"),
  AUTH_GOOGLE_ID: optional,
  AUTH_GOOGLE_SECRET: optional,
  ML_API_URL: z.url("must be a URL").default("http://localhost:8000"),
  ML_ADMIN_TOKEN: optional,
  MODEL_DRIVE_FILE_ID: optional,
  GOOGLE_SERVICE_ACCOUNT_JSON: optional,
  LLM_PROVIDER: z.enum(["ollama", "anthropic", "openai", "gemini", "none"]).default("ollama"),
  OLLAMA_URL: z.url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:3b"),
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: z.string().default("claude-haiku-5-5"),
  OPENAI_API_KEY: optional,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  ALLOWED_ORIGINS: optional,
});

export type Env = z.infer<typeof schema>;

const OPTIONAL_NOTES: Record<string, string> = {
  AUTH_GOOGLE_ID: "Google sign-in hidden",
  AUTH_GOOGLE_SECRET: "Google sign-in hidden",
  ML_ADMIN_TOKEN: "ML service only: /admin/reload-model disabled",
  MODEL_DRIVE_FILE_ID: "ML service only: model is not downloaded from Drive",
  GOOGLE_SERVICE_ACCOUNT_JSON: "ML service only: using shared-link download",
};

let cached: Env | null = null;

/** Validated environment. Throws with a readable list when a required variable is missing. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment (see .env.example):\n${lines.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Called once at server start (instrumentation.ts): prints what is missing. */
export function reportEnv(): void {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("\n[env] Missing or invalid variables. Copy .env.example to .env (or run npm run setup):");
    for (const i of parsed.error.issues) console.error(`  ✗ ${i.path.join(".")}: ${i.message}`);
    console.error("");
    return;
  }
  const e = parsed.data;
  const missing = Object.entries(OPTIONAL_NOTES).filter(([k]) => !e[k as keyof Env]);
  const keyFor = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" } as const;
  const llmKey = e.LLM_PROVIDER in keyFor ? keyFor[e.LLM_PROVIDER as keyof typeof keyFor] : null;
  console.log(`[env] OK · LLM_PROVIDER=${e.LLM_PROVIDER} · ML_API_URL=${e.ML_API_URL}`);
  if (llmKey && !e[llmKey]) console.warn(`[env] ⚠ ${llmKey} is not set: the assistant will use template replies`);
  for (const [k, note] of missing) console.log(`[env] · ${k} not set (${note})`);
}
