import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser, parseBody, HttpError } from "@/lib/api";
import { completeText, LlmUnavailableError } from "@/lib/llm";
import { projectSchema } from "@/lib/validators";

// "Rewrite in plain words": a 2-3 sentence simple version of a card that keeps every fact.
// Cached per card, so each card costs at most one LLM call.
const cache = new Map<string, string>();
const MAX_CACHE = 500;

const SYSTEM = `You rewrite project problem statements for a final-year B.Tech student in plain, simple English.
Write 2-3 short sentences. Keep every fact: who has the problem, what goes wrong, what to build, and how success is measured.
Do not add facts, numbers, names or claims that are not in the text. No headings, no lists, no preamble.`;

export const POST = withUser(async ({ req }) => {
  const { project } = await parseBody(req, z.object({ project: projectSchema }));
  const key = `${project.id}:${project.title}`;
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ text: hit, cached: true });
  let text: string;
  try {
    text = await completeText({
      system: SYSTEM,
      messages: [{ role: "user", content: `Title: ${project.title}\n\n${project.problem_statement}` }],
      maxTokens: 160,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    if (e instanceof LlmUnavailableError || (e instanceof Error && e.name === "TimeoutError"))
      throw new HttpError(503, "The writer is offline right now. Try again in a moment.", "llm_unavailable");
    throw e;
  }
  text = text.trim().replace(/^["']|["']$/g, "");
  if (!text) throw new HttpError(502, "The writer returned nothing. Try again.", "llm_empty");
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, text);
  return NextResponse.json({ text, cached: false });
});
