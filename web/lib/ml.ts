import "server-only";
import { z } from "zod";
import {
  appliedFiltersSchema,
  generateResponseSchema,
  projectListSchema,
  type AppliedFilters,
  type GenerateResponse,
  type Project,
} from "./validators";

// Typed client for the ProjectLens ML service (three models). Server-only: ML_API_URL never
// reaches the browser.
//   model 1  POST /intent     DistilBERT intent classifier (501 until installed)
//   model 2  POST /recommend  MiniLM retriever + ranking rules
//   model 3  POST /generate   Qwen2.5 via Ollama writes new ideas grounded in model 2's matches

export class MlUnavailableError extends Error {
  constructor(
    message = "The ML service is unavailable",
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MlUnavailableError";
  }
}
export class MlInvalidProfileError extends Error {
  constructor(public detail: unknown) {
    super("The ML service rejected the profile");
    this.name = "MlInvalidProfileError";
  }
}

export type MlProfile = {
  skills: string[];
  interests: string[];
  level: string;
  weeks: number;
  hardware_ok: boolean;
};

export type RecommendRequest = {
  profile: MlProfile;
  message?: string;
  k?: number;
  exclude_core_ids?: string[];
  explore?: number;
  diversity?: number;
  seed?: number;
  /** Explicit filters; when omitted the ranking reads them from the message. */
  domains?: string[] | null;
  approaches?: string[] | null;
  levels?: string[] | null;
};

export type RecommendResult = { projects: Project[]; exhausted: boolean; applied: AppliedFilters | null };
export type GenerateResult = GenerateResponse & { exhausted: false };

const healthSchema = z.object({
  status: z.string(),
  projects_indexed: z.number().optional().default(0),
  intent_model: z.boolean().optional().default(false),
  intent_version: z.string().nullable().optional(),
  message: z.string().optional(),
});
export type MlHealth = z.infer<typeof healthSchema>;

const intentSchema = z.object({
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  raw_intent: z.string().optional(),
  low_confidence: z.boolean().optional(),
});

const understandSchema = z.object({
  domains: z.array(z.string()).default([]),
  approaches: z.array(z.string()).default([]),
  levels: z.array(z.string()).nullable().default(null),
  weeks: z.number().nullable().default(null),
  hardware_ok: z.boolean().nullable().default(null),
});
export type Understood = z.infer<typeof understandSchema>;

const TIMEOUT_MS = 15_000;
/** /generate runs a local LLM, often more than once; see ML_GENERATE_TIMEOUT_MS in .env.example. */
export const generateTimeoutMs = () => Number(process.env.ML_GENERATE_TIMEOUT_MS) || 60_000;
const baseUrl = () => (process.env.ML_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...args) => fetch(...args);
/** Tests can swap the transport. */
export function __setFetch(f: FetchLike | null) {
  fetchImpl = f ?? ((...args) => fetch(...args));
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

/** One request with a timeout and a single retry when the network fails (not on HTTP errors or timeouts). */
async function call(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = TIMEOUT_MS, ...rest } = init;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchImpl(`${baseUrl()}${path}`, {
        ...rest,
        headers: { "content-type": "application/json", ...rest.headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      if (isTimeout(err)) throw new MlUnavailableError(`ML service timed out after ${timeoutMs / 1000}s`, err);
      if (attempt >= 1) throw new MlUnavailableError("ML service is unreachable", err);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

function readApplied(res: Response): AppliedFilters | null {
  const raw = res.headers.get("x-applied-filters");
  if (!raw) return null;
  try {
    const parsed = appliedFiltersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function recommend(req: RecommendRequest): Promise<RecommendResult> {
  const res = await call("/recommend", { method: "POST", body: JSON.stringify({ k: 5, ...req }) });
  const applied = readApplied(res);
  if (res.status === 404) return { projects: [], exhausted: true, applied };
  if (res.status === 422) throw new MlInvalidProfileError(await res.json().catch(() => null));
  if (!res.ok) throw new MlUnavailableError(`ML service answered ${res.status}`);
  const parsed = projectListSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new MlUnavailableError("ML service returned an unexpected response", parsed.error);
  return { projects: parsed.data.map((p) => ({ ...p, kind: "catalogue" as const })), exhausted: false, applied };
}

export class MlExhaustedError extends Error {
  constructor(public applied: AppliedFilters | null) {
    super("No projects left for this profile");
    this.name = "MlExhaustedError";
  }
}

/**
 * Model 3. Throws MlUnavailableError on timeout/5xx (callers fall back to /recommend) and
 * MlExhaustedError on 404 (nothing left that fits).
 */
export async function generate(req: RecommendRequest): Promise<GenerateResult> {
  const res = await call("/generate", {
    method: "POST",
    body: JSON.stringify({ k: 3, ...req }),
    timeoutMs: generateTimeoutMs(),
  });
  if (res.status === 404) throw new MlExhaustedError(readApplied(res));
  if (res.status === 422) throw new MlInvalidProfileError(await res.json().catch(() => null));
  if (!res.ok) throw new MlUnavailableError(`ML service answered ${res.status} on /generate`);
  const parsed = generateResponseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new MlUnavailableError("/generate returned an unexpected response", parsed.error);
  return { ...parsed.data, exhausted: false };
}

export async function health(): Promise<MlHealth> {
  const res = await call("/health", { timeoutMs: 3000 });
  const parsed = healthSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new MlUnavailableError("Bad /health response");
  return parsed.data;
}

/**
 * Model 1. Returns {intent, confidence} using the classifier's `intent` field (which is already
 * "general_question" below its confidence threshold), or null when it is not installed (501),
 * unreachable, or malformed, so callers fall back to the rules.
 */
export async function remoteIntent(text: string): Promise<{ intent: string; confidence: number } | null> {
  try {
    const res = await call("/intent", { method: "POST", body: JSON.stringify({ text }), timeoutMs: 2500 });
    if (res.status !== 200) return null;
    const parsed = intentSchema.safeParse(await res.json().catch(() => null));
    return parsed.success ? { intent: parsed.data.intent, confidence: parsed.data.confidence } : null;
  } catch {
    return null;
  }
}

/** What the ranking reads from a message (domains, approaches, levels, weeks, hardware), relative to `level`. */
export async function understand(text: string, level?: string): Promise<Understood | null> {
  try {
    const q = level ? `?level=${encodeURIComponent(level)}` : "";
    const res = await call(`/understand${q}`, { method: "POST", body: JSON.stringify({ text }), timeoutMs: 3000 });
    if (!res.ok) return null;
    const parsed = understandSchema.safeParse(await res.json().catch(() => null));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
