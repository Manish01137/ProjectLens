// Decides what the assistant does with each message, so it answers what was actually asked.
//
//   message ─► intent (model 1, else rules) ─► safety overrides ─┬─ greeting / chitchat / general_question ─► LLM reply
//                                                                 ├─ ask_project / refine_project ─► /generate (model 3),
//                                                                 │      fallback /recommend (model 2) ─► project cards
//                                                                 ├─ explain_project ─► LLM plan for the referenced card
//                                                                 └─ profile_update ─► LLM-extracted change, saved
//
// Pure orchestration: the ML service, LLM and database are injected (lib/chat/deps.ts), so every
// branch is unit-tested with fakes (tests/router.test.ts).

import type { Level } from "../constants";
import { ideaToProject } from "../cards";
import { buildPlanOutline, planToMarkdown } from "../plan";
import type { AppliedFilters, GenerateResponse, Project } from "../validators";
import { currentLevel, fromApplied, mergeFilters, understandLocally, type CarriedFilters, type Wish } from "./carry";
import { decideIntent, type Intent, type IntentResult } from "./intent";
import { chitchatInstruction, explainInstruction, greetingInstruction, systemPrompt } from "./prompts";
import { describePatch, extractProfileUpdate, joinList, resolveCardReference, type ProfilePatch } from "./understand";

export type ChatProfile = {
  name: string;
  branch: string | null;
  semester: number | null;
  skills: string[];
  interests: string[];
  level: Level;
  weeks: number;
  hardwareOk: boolean;
  goal: string;
};

export type HistoryMessage = { role: "user" | "assistant"; content: string };

/** Body sent to /generate and (on fallback) /recommend. */
export type ProjectRequest = {
  profile: { skills: string[]; interests: string[]; level: string; weeks: number; hardware_ok: boolean };
  message: string;
  k: number;
  exclude_core_ids: string[];
  domains?: string[] | null;
  approaches?: string[] | null;
  levels?: string[] | null;
};

export type CardsMeta = {
  applied: AppliedFilters | null;
  /** What was asked for, so the UI can explain a relaxed filter. */
  requested?: { levels: string[] | null; approaches: string[] | null };
  grounding: string[];
  source: string; // generated | mixed | catalogue
  writerOffline: boolean;
  rejected: number;
};

export type ChatEvent =
  | { type: "intent"; intent: Intent; confidence: number; source: IntentResult["source"]; override: string | null }
  | { type: "status"; text: string }
  | { type: "cards"; projects: Project[]; meta: CardsMeta }
  | { type: "token"; text: string }
  | { type: "profile"; summary: string };

export type RouteResult = {
  intent: Intent;
  confidence: number;
  intentSource: IntentResult["source"];
  content: string;
  projects: Project[] | null;
  meta: CardsMeta | null;
  /** Filters to remember for this conversation (null: keep what was stored). */
  filters: CarriedFilters | null;
  error?: "ml_unavailable";
};

export type RouterDeps = {
  remoteIntent(text: string): Promise<{ intent: string; confidence: number } | null>;
  understand(text: string, level: string): Promise<Wish | null>;
  /** Model 3. Throws on timeout/error (→ fallback); signals 404 through isExhausted. */
  generate(req: ProjectRequest): Promise<GenerateResponse>;
  /** Model 2. Returns exhausted on 404. */
  recommend(req: ProjectRequest): Promise<{ projects: Project[]; exhausted: boolean; applied: AppliedFilters | null }>;
  /** Adds shown cards to the student's seen list. */
  recordShown(cards: Project[]): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<ChatProfile>;
  /** LLM JSON extraction, validated. Null when no LLM is reachable or nothing valid came back. */
  extractProfile(text: string, profile: ChatProfile): Promise<ProfilePatch | null>;
  /** Streams LLM text; must throw before the first token when no LLM is reachable. */
  stream(args: { system: string; messages: HistoryMessage[]; maxTokens?: number; signal?: AbortSignal }): AsyncIterable<string>;
  isMlUnavailable(err: unknown): boolean;
  /** For a 404 from /generate: the filters it applied; undefined when err is not a 404. */
  exhaustedApplied(err: unknown): AppliedFilters | null | undefined;
  /** Delay between words when streaming a template reply (0 in tests). */
  wordDelayMs?: number;
};

export type RouterInput = {
  message: string;
  profile: ChatProfile;
  history: HistoryMessage[]; // most recent last; trimmed to 6
  lastCards: Project[]; // cards most recently shown in this chat
  lastTurnHadCards: boolean; // the latest assistant turn showed cards
  lastFilters: CarriedFilters | null; // filters last applied in this chat
  excludeCoreIds: string[]; // every inspired_by / grounding id shown in this chat, plus the seen list
  signal?: AbortSignal;
};

export const HISTORY_LIMIT = 6;
const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";

async function* streamWords(text: string, delay: number, signal?: AbortSignal): AsyncGenerator<string> {
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += 2) {
    if (signal?.aborted) return;
    yield parts[i]! + (parts[i + 1] ?? "");
    if (delay) await new Promise((r) => setTimeout(r, delay));
  }
}

function cardsIntro(cards: Project[], meta: CardsMeta): string {
  const n = cards.length;
  const skills = [...new Set(cards.flatMap((p) => p.skills_used ?? p.matched_skills))].slice(0, 3);
  const using = skills.length ? ` built around your ${joinList(skills)} skills` : "";
  if (meta.source === "generated")
    return `Here ${n === 1 ? "is a new idea" : `are ${n} new ideas`}${using}, each grounded in a real project from the catalogue. Open a card for the milestones, or ask me how to build one.`;
  if (meta.source === "mixed")
    return `Here are ${n} ideas${using}: new ones where they passed every check, and the closest catalogue projects for the rest. Ask me how to build any of them.`;
  return `Here ${n === 1 ? "is the closest project" : `are the ${n} closest projects`} from the catalogue${using}. Open any card for the full brief, or ask me how to build one.`;
}

const ML_DOWN = "Recommendations are warming up, try again in a moment. I can still answer questions in the meantime.";

export function exhaustedMessage(domains: string[]): string {
  return domains.length
    ? `You've seen every ${joinList(domains)} idea that fits. Want to widen the domain or level?`
    : "You've seen every idea that fits. Want to widen the domain or level?";
}

/** Routes one message. Yields events for the UI as they happen and returns the final message. */
export async function* routeMessage(input: RouterInput, deps: RouterDeps): AsyncGenerator<ChatEvent, RouteResult> {
  const { message, profile, lastCards, signal } = input;
  const history = input.history.slice(-HISTORY_LIMIT);
  const delay = deps.wordDelayMs ?? 18;
  const decision = decideIntent(
    message,
    { hasCards: lastCards.length > 0, lastTurnHadCards: input.lastTurnHadCards },
    await deps.remoteIntent(message),
  );
  const intent = decision.intent;
  yield { type: "intent", intent, confidence: decision.confidence, source: decision.source, override: decision.override };

  let content = "";
  const done = (extra: Partial<RouteResult> = {}): RouteResult => ({
    intent,
    confidence: decision.confidence,
    intentSource: decision.source,
    content,
    projects: null,
    meta: null,
    filters: null,
    ...extra,
  });

  // Streams LLM text, falling back to a template when no LLM is reachable before the first token.
  async function* say(instruction: string | null, fallback: string, maxTokens = 500): AsyncGenerator<ChatEvent> {
    if (instruction !== null) {
      const messages: HistoryMessage[] = [...history, { role: "user", content: instruction ? `${message}\n\n(${instruction})` : message }];
      let started = false;
      try {
        for await (const t of deps.stream({ system: systemPrompt(profile), messages, maxTokens, signal })) {
          if (signal?.aborted) return;
          started = true;
          content += t;
          yield { type: "token", text: t };
        }
        if (started) return;
      } catch {
        if (signal?.aborted) return;
        if (started) {
          const note = "\n\n_(The connection to the language model dropped. Ask again to continue.)_";
          content += note;
          yield { type: "token", text: note };
          return;
        }
      }
    }
    for await (const w of streamWords(fallback, delay, signal)) {
      content += w;
      yield { type: "token", text: w };
    }
  }

  // ask_project / refine_project: /generate first, /recommend when the writer is slow or down.
  async function* findProjects(refine: boolean): AsyncGenerator<ChatEvent, RouteResult> {
    const req: ProjectRequest = {
      profile: { skills: profile.skills, interests: profile.interests, level: profile.level, weeks: profile.weeks, hardware_ok: profile.hardwareOk },
      message,
      k: 3,
      exclude_core_ids: input.excludeCoreIds,
    };
    // A fresh request uses only what this message asks for; a refinement carries the conversation's
    // filters, merged with what this message adds.
    const level = refine ? currentLevel(input.lastFilters, profile.level) : profile.level;
    const wish = (await deps.understand(message, level)) ?? understandLocally(message, level);
    const carried: CarriedFilters = mergeFilters(refine ? input.lastFilters : null, wish, message);
    req.domains = carried.domains.length ? carried.domains : refine ? [] : null;
    req.approaches = carried.approaches.length ? carried.approaches : null;
    req.levels = carried.levels.length ? carried.levels : null;
    if (carried.weeks) req.profile.weeks = carried.weeks;
    if (carried.hardware_ok !== null) req.profile.hardware_ok = carried.hardware_ok;

    let cards: Project[];
    let meta: CardsMeta;
    const exhaustedDomains = (applied: AppliedFilters | null | undefined) =>
      applied?.domains?.length ? applied.domains : carried.domains;
    yield { type: "status", text: "Writing new ideas grounded in the catalogue…" };
    try {
      const gen = await deps.generate(req);
      cards = gen.ideas.map((i) => ideaToProject(i, gen.applied, (req.levels?.[0] as Level | undefined) ?? profile.level));
      meta = {
        applied: gen.applied,
        requested: { levels: req.levels ?? null, approaches: req.approaches ?? null },
        grounding: gen.grounding,
        source: gen.source,
        writerOffline: gen.source === "catalogue" && Boolean(gen.llm_error),
        rejected: gen.rejected.length,
      };
    } catch (err) {
      const applied404 = deps.exhaustedApplied(err);
      if (applied404 !== undefined) {
        yield* say(null, exhaustedMessage(exhaustedDomains(applied404)));
        return done({ filters: fromApplied(applied404) ?? carried });
      }
      if (!deps.isMlUnavailable(err)) throw err;
      // The writer timed out or failed: same request to the retriever, 5 catalogue projects.
      let rec: Awaited<ReturnType<RouterDeps["recommend"]>>;
      try {
        rec = await deps.recommend({ ...req, k: 5 });
      } catch (err2) {
        if (!deps.isMlUnavailable(err2)) throw err2;
        yield* say(null, ML_DOWN);
        return done({ error: "ml_unavailable", filters: carried });
      }
      if (rec.exhausted || !rec.projects.length) {
        yield* say(null, exhaustedMessage(exhaustedDomains(rec.applied)));
        return done({ filters: fromApplied(rec.applied) ?? carried });
      }
      cards = rec.projects.map((p) => ({ ...p, kind: "catalogue" as const }));
      meta = {
        applied: rec.applied,
        requested: { levels: req.levels ?? null, approaches: req.approaches ?? null },
        grounding: [],
        source: "catalogue",
        writerOffline: true,
        rejected: 0,
      };
    }

    if (!cards.length) {
      yield* say(null, exhaustedMessage(exhaustedDomains(meta.applied)));
      return done({ filters: fromApplied(meta.applied) ?? carried });
    }
    await deps.recordShown(cards);
    yield { type: "cards", projects: cards, meta };
    yield* say(null, cardsIntro(cards, meta));
    return done({ projects: cards, meta, filters: fromApplied(meta.applied) ?? carried });
  }

  switch (intent) {
    case "greeting": {
      const hour = new Date().getHours();
      const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      yield* say(
        greetingInstruction,
        `${part}, ${firstName(profile.name)}. Want me to suggest a project that fits your skills, or help plan one you have in mind?`,
        70,
      );
      return done();
    }
    case "chitchat": {
      yield* say(
        chitchatInstruction,
        /thank/i.test(message)
          ? "You're welcome. Ask me anytime, whether it's a new idea or a tricky part of your build."
          : "I'm doing well, thanks for asking. Whenever you're ready, I can suggest a project or help you plan one.",
        70,
      );
      return done();
    }
    case "general_question": {
      yield* say(
        "",
        "I can't reach my language model right now, so I can't answer that properly yet. I can still find projects for you (try \"suggest a project\"), and full answers will work again once the model is back.",
        700,
      );
      return done();
    }
    case "ask_project":
      return yield* findProjects(false);
    case "refine_project":
      return yield* findProjects(true);
    case "explain_project": {
      const idx = resolveCardReference(message, lastCards);
      if (idx === null) {
        const list = lastCards.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
        yield* say(null, `Which one should I explain? Tell me the number:\n\n${list}`);
        return done();
      }
      const project = lastCards[idx]!;
      const outline = buildPlanOutline(project, profile);
      yield* say(explainInstruction(project, outline, idx, profile.skills), planToMarkdown(project, outline), 900);
      return done();
    }
    case "profile_update": {
      const patch = (await deps.extractProfile(message, profile)) ?? extractProfileUpdate(message, profile);
      if (!patch) {
        yield* say(
          null,
          "I couldn't tell what to change. You can say things like \"I also know Docker now\" or \"we have 8 weeks\", or edit everything on your Profile page.",
        );
        return done();
      }
      await deps.updateProfile(patch);
      const summary = describePatch(patch);
      yield { type: "profile", summary };
      yield* say(null, `Got it: I ${summary}, and your next suggestions will use that.`);
      return done();
    }
  }
}

