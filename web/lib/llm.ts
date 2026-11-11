import "server-only";

// Text generation behind one interface: LLM_PROVIDER=ollama (default) | anthropic | openai | gemini | none.
// The LLM only writes prose. Project cards always come from the ML service's /recommend.

export type LlmMessage = { role: "user" | "assistant"; content: string };
export type LlmRequest = { system: string; messages: LlmMessage[]; maxTokens?: number; signal?: AbortSignal };
export type Provider = "ollama" | "anthropic" | "openai" | "gemini" | "none";

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

const provider = (): Provider => {
  const p = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
  return (["ollama", "anthropic", "openai", "gemini", "none"].includes(p) ? p : "ollama") as Provider;
};

// After a connection failure, skip the provider for a short while so chat replies stay fast.
let downUntil = 0;
const COOLDOWN_MS = 30_000;

function signalWith(timeoutMs: number, outer?: AbortSignal) {
  const t = AbortSignal.timeout(timeoutMs);
  return outer ? AbortSignal.any([t, outer]) : t;
}

async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        yield line;
      }
    }
    if (buf) yield buf;
  } finally {
    reader.releaseLock();
  }
}

async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  for await (const line of lines(body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      yield JSON.parse(data);
    } catch {
      /* ignore keep-alives */
    }
  }
}

async function open(url: string, init: RequestInit, label: string, timeoutMs: number, outer?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: signalWith(timeoutMs, outer) });
  } catch (err) {
    if (outer?.aborted) throw err;
    downUntil = Date.now() + COOLDOWN_MS;
    throw new LlmUnavailableError(`${label} is unreachable`);
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status >= 500 || res.status === 404 || res.status === 401 || res.status === 403) downUntil = Date.now() + COOLDOWN_MS;
    throw new LlmUnavailableError(`${label} answered ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.body;
}

async function* ollama(req: LlmRequest): AsyncGenerator<string> {
  const base = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/+$/, "");
  const body = await open(
    `${base}/api/chat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
        stream: true,
        messages: [{ role: "system", content: req.system }, ...req.messages],
        options: { temperature: 0.5, num_predict: req.maxTokens ?? 700 },
      }),
    },
    "Ollama",
    90_000, // first call loads the model into memory
    req.signal,
  );
  for await (const line of lines(body)) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
      if (j.error) throw new LlmUnavailableError(`Ollama: ${j.error}`);
      if (j.message?.content) yield j.message.content;
      if (j.done) return;
    } catch (e) {
      if (e instanceof LlmUnavailableError) throw e;
    }
  }
}

async function* anthropic(req: LlmRequest): AsyncGenerator<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LlmUnavailableError("ANTHROPIC_API_KEY is not set");
  const body = await open(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
        max_tokens: req.maxTokens ?? 700,
        system: req.system,
        messages: req.messages,
        stream: true,
      }),
    },
    "Anthropic",
    30_000,
    req.signal,
  );
  for await (const ev of sseData(body)) {
    const e = ev as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
    if (e.type === "content_block_delta" && e.delta?.type === "text_delta" && e.delta.text) yield e.delta.text;
    if (e.type === "error") throw new LlmUnavailableError(`Anthropic: ${e.error?.message ?? "stream error"}`);
  }
}

async function* openai(req: LlmRequest): AsyncGenerator<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new LlmUnavailableError("OPENAI_API_KEY is not set");
  const body = await open(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        stream: true,
        max_tokens: req.maxTokens ?? 700,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
    },
    "OpenAI",
    30_000,
    req.signal,
  );
  for await (const ev of sseData(body)) {
    const text = (ev as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

async function* gemini(req: LlmRequest): AsyncGenerator<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmUnavailableError("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const body = await open(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: req.maxTokens ?? 700, temperature: 0.5 },
      }),
    },
    "Gemini",
    30_000,
    req.signal,
  );
  for await (const ev of sseData(body)) {
    const parts = (ev as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts;
    for (const p of parts ?? []) if (p.text) yield p.text;
  }
}

/** Streams text from the configured provider. Throws LlmUnavailableError before the first token if it can't. */
export async function* streamText(req: LlmRequest): AsyncGenerator<string> {
  const p = provider();
  if (p === "none") throw new LlmUnavailableError("LLM_PROVIDER=none");
  if (Date.now() < downUntil) throw new LlmUnavailableError(`${p} was unreachable a moment ago`);
  const impl = { ollama, anthropic, openai, gemini }[p];
  yield* impl(req);
}

export async function completeText(req: LlmRequest): Promise<string> {
  let out = "";
  for await (const t of streamText(req)) out += t;
  return out;
}

/** Pulls the first JSON object out of a reply (models sometimes wrap it in prose or ``` fences). */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Structured output. Ollama (0.5+) gets the JSON schema as `format`, so the reply is guaranteed
 * JSON; other providers are asked for JSON and parsed defensively. Throws LlmUnavailableError.
 */
export async function completeJson(req: { system: string; user: string; schema: object; signal?: AbortSignal; maxTokens?: number }): Promise<unknown> {
  const p = provider();
  if (p === "none") throw new LlmUnavailableError("LLM_PROVIDER=none");
  if (Date.now() < downUntil) throw new LlmUnavailableError(`${p} was unreachable a moment ago`);
  if (p === "ollama") {
    const base = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/+$/, "");
    let res: Response;
    try {
      res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: signalWith(60_000, req.signal),
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
          stream: false,
          format: req.schema,
          options: { temperature: 0, num_predict: req.maxTokens ?? 300 },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
        }),
      });
    } catch (err) {
      if (req.signal?.aborted) throw err;
      downUntil = Date.now() + COOLDOWN_MS;
      throw new LlmUnavailableError("Ollama is unreachable");
    }
    if (!res.ok) throw new LlmUnavailableError(`Ollama answered ${res.status}`);
    const j = (await res.json().catch(() => null)) as { message?: { content?: string } } | null;
    return parseJsonObject(j?.message?.content ?? "");
  }
  const text = await completeText({
    system: `${req.system}\nReply with one JSON object only, no prose, matching: ${JSON.stringify(req.schema)}`,
    messages: [{ role: "user", content: req.user }],
    maxTokens: req.maxTokens ?? 300,
    signal: req.signal,
  });
  return parseJsonObject(text);
}

export async function llmStatus(): Promise<{ provider: Provider; ok: boolean; detail: string }> {
  const p = provider();
  if (p === "none") return { provider: p, ok: false, detail: "Template replies only" };
  if (p === "ollama") {
    const base = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
      const j = (await res.json()) as { models?: { name: string }[] };
      const want = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
      const has = j.models?.some((m) => m.name === want || m.name.startsWith(`${want}:`));
      return { provider: p, ok: Boolean(has), detail: has ? want : `${want} not pulled yet (ollama pull ${want})` };
    } catch {
      return { provider: p, ok: false, detail: `Ollama not reachable at ${base}` };
    }
  }
  const key = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" }[p];
  return process.env[key]
    ? { provider: p, ok: Date.now() >= downUntil, detail: Date.now() >= downUntil ? "API key set" : "Recent request failed" }
    : { provider: p, ok: false, detail: `${key} is not set` };
}
