import { z } from "zod";
import { auth } from "@/auth";
import { HttpError, jsonError, parseBody, toErrorResponse } from "@/lib/api";
import { conversationCoreIds, createDeps, loadChatProfile } from "@/lib/chat/deps";
import { seenCoreIds } from "@/lib/recommend";
import type { CarriedFilters } from "@/lib/chat/carry";
import { HISTORY_LIMIT, routeMessage, type CardsMeta, type ChatEvent, type HistoryMessage, type RouteResult } from "@/lib/chat/router";
import { titleFromMessage } from "@/lib/chat/understand";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { projectListSchema, chatBodySchema, type Project } from "@/lib/validators";

export const dynamic = "force-dynamic";
// /generate can take up to ML_GENERATE_TIMEOUT_MS (60 s) plus the /recommend fallback.
export const maxDuration = 120;

const carriedSchema = z.object({
  domains: z.array(z.string()),
  approaches: z.array(z.string()),
  levels: z.array(z.string()),
  weeks: z.number().nullable(),
  hardware_ok: z.boolean().nullable(),
});
const parseCarried = (v: unknown): CarriedFilters | null => {
  const r = carriedSchema.safeParse(v);
  return r.success ? r.data : null;
};

/**
 * POST { chatId?, message, regenerate? } → text/event-stream
 *   event: meta    { chatId, userMessageId, title }
 *   event: intent  { intent, confidence, source, override }
 *   event: status  { text }                      (while /generate writes ideas)
 *   event: cards   { projects, meta: { applied, grounding, source, writerOffline, rejected } }
 *   event: token   { text }
 *   event: profile { summary }
 *   event: done    { messageId, intent }
 *   event: error   { message }
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return jsonError(401, "Please sign in", "unauthorized");
  const rl = rateLimit(`api:${userId}:/api/chat`, 30);
  if (!rl.ok) return jsonError(429, "You're going a little fast. Try again in a moment.", "rate_limited", { "Retry-After": String(rl.retryAfter) });

  let chatId: string;
  let userMessageId: string;
  let text: string;
  let title: string;
  let history: HistoryMessage[];
  let lastCards: Project[];
  let lastTurnHadCards: boolean;
  let lastFilters: CarriedFilters | null;
  let excludeCoreIds: string[];
  let profile: Awaited<ReturnType<typeof loadChatProfile>>;
  try {
    const body = await parseBody(req, chatBodySchema);
    profile = await loadChatProfile(userId, session.user?.name);
    if (!profile || !profile.skills.length) throw new HttpError(409, "Finish your profile first", "profile_incomplete");

    let chat = body.chatId ? await db.chat.findFirst({ where: { id: body.chatId, userId } }) : null;
    if (body.chatId && !chat) throw new HttpError(404, "Chat not found", "not_found");
    if (!chat) chat = await db.chat.create({ data: { userId, title: titleFromMessage(body.message) } });
    chatId = chat.id;
    title = chat.title;

    if (body.regenerate) {
      // Replace the last assistant reply, answering the last user message again.
      const last = await db.message.findMany({ where: { chatId }, orderBy: { createdAt: "desc" }, take: 2 });
      const [a, u] = last;
      if (a?.role === "assistant") await db.message.delete({ where: { id: a.id } });
      const lastUser = a?.role === "user" ? a : u?.role === "user" ? u : null;
      if (!lastUser) throw new HttpError(400, "Nothing to regenerate", "invalid");
      text = lastUser.content;
      userMessageId = lastUser.id;
    } else {
      text = body.message;
      userMessageId = (await db.message.create({ data: { chatId, role: "user", content: text } })).id;
    }

    const recent = await db.message.findMany({
      where: { chatId, id: { not: userMessageId } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
    history = recent.reverse().map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    // Conversation context: cards shown, filters carried, problems already used.
    const assistantTurns = await db.message.findMany({
      where: { chatId, role: "assistant" },
      orderBy: { createdAt: "desc" },
      select: { projects: true, meta: true },
    });
    const hasCardsIn = (m: { projects: unknown }) => Array.isArray(m.projects) && m.projects.length > 0;
    const withCards = assistantTurns.find(hasCardsIn);
    const parsed = projectListSchema.safeParse(withCards?.projects ?? []);
    lastCards = parsed.success ? parsed.data : [];
    lastTurnHadCards = Boolean(assistantTurns[0] && hasCardsIn(assistantTurns[0]));
    lastFilters = parseCarried(chat.lastFilters);
    // Everything this conversation has used (inspired_by + grounding) plus the student's seen list.
    excludeCoreIds = [...new Set([...conversationCoreIds(assistantTurns), ...(await seenCoreIds(userId))])];
  } catch (err) {
    return toErrorResponse(err);
  }

  const enc = new TextEncoder();
  const deps = createDeps(userId, session.user?.name);
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      send("meta", { chatId, userMessageId, title });

      let partial = "";
      let cards: Project[] | null = null;
      let meta: CardsMeta | null = null;
      let intent: string | null = null;
      let result: RouteResult | null = null;
      try {
        const gen = routeMessage(
          { message: text, profile: profile!, history, lastCards, lastTurnHadCards, lastFilters, excludeCoreIds, signal: abort.signal },
          deps,
        );
        for (;;) {
          const step = await gen.next();
          if (step.done) {
            result = step.value;
            break;
          }
          const ev: ChatEvent = step.value;
          if (ev.type === "token") partial += ev.text;
          if (ev.type === "cards") {
            cards = ev.projects;
            meta = ev.meta;
          }
          if (ev.type === "intent") {
            intent = ev.intent;
            // Saved on the user's message: what was understood, how sure, and by which classifier.
            await db.message.update({
              where: { id: userMessageId },
              data: { intent: ev.intent, confidence: ev.confidence, intentSource: ev.source },
            });
          }
          const { type, ...data } = ev;
          send(type, data);
        }
      } catch (err) {
        console.error("[chat] route failed", err);
        if (!partial) partial = "Sorry, something went wrong on my side. Please try again.";
        send("error", { message: "Something went wrong. Please try again." });
      }

      const content = (result?.content ?? partial).trim() || (abort.signal.aborted ? "_(stopped)_" : "");
      const saved = await db.message.create({
        data: {
          chatId,
          role: "assistant",
          content,
          projects: result?.projects ?? cards ?? undefined,
          meta: result?.meta ?? meta ?? undefined,
          intent: result?.intent ?? intent,
        },
      });
      await db.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date(), ...(result?.filters ? { lastFilters: result.filters } : {}) },
      });
      send("done", { messageId: saved.id, intent: saved.intent });
      closed = true;
      try {
        controller.close();
      } catch {
        /* client already gone */
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
