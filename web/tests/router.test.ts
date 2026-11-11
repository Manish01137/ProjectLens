import { describe, expect, it } from "vitest";
import { routeMessage, type CardsMeta, type ChatEvent, type RouteResult, type RouterInput } from "@/lib/chat/router";
import type { CarriedFilters } from "@/lib/chat/carry";
import { coreIdsOf } from "@/lib/cards";
import type { Project } from "@/lib/validators";
import { fakeDeps, profile } from "./fixtures";

type Deps = ReturnType<typeof fakeDeps>["deps"];

async function run(input: Partial<RouterInput> & { message: string }, deps: Deps) {
  const events: ChatEvent[] = [];
  const gen = routeMessage(
    { profile, history: [], lastCards: [], lastTurnHadCards: false, lastFilters: null, excludeCoreIds: [], ...input },
    deps,
  );
  let result: RouteResult;
  for (;;) {
    const s = await gen.next();
    if (s.done) {
      result = s.value;
      break;
    }
    events.push(s.value);
  }
  const cardsEv = events.find((e): e is Extract<ChatEvent, { type: "cards" }> => e.type === "cards");
  const cards = cardsEv?.projects ?? [];
  const text = events.flatMap((e) => (e.type === "token" ? [e.text] : [])).join("");
  const intentEv = events.find((e): e is Extract<ChatEvent, { type: "intent" }> => e.type === "intent")!;
  return { events, result, cards, meta: cardsEv?.meta as CardsMeta | undefined, text, intentEv };
}

/** Follows a conversation the way the chat route does: carries cards, filters and used ids. */
function conversation(deps: Deps) {
  let lastCards: Project[] = [];
  let lastTurnHadCards = false;
  let lastFilters: CarriedFilters | null = null;
  const used = new Set<string>();
  return async (message: string) => {
    const r = await run({ message, lastCards, lastTurnHadCards, lastFilters, excludeCoreIds: [...used] }, deps);
    lastTurnHadCards = r.cards.length > 0;
    if (r.cards.length) lastCards = r.cards;
    if (r.result.filters) lastFilters = r.result.filters;
    for (const c of r.cards) for (const id of coreIdsOf(c)) used.add(id);
    for (const g of r.meta?.grounding ?? []) used.add(g);
    return r;
  };
}

describe("chat router: the spec's cases (ML service mocked)", () => {
  it('"hi" makes no project call', async () => {
    const { deps, calls } = fakeDeps();
    const r = await run({ message: "hi" }, deps);
    expect(r.result.intent).toBe("greeting");
    expect(r.cards).toHaveLength(0);
    expect(calls.generate).toHaveLength(0);
    expect(calls.recommend).toHaveLength(0);
  });

  it('"suggest a healthcare project" calls /generate with Healthcare', async () => {
    const { deps, calls } = fakeDeps();
    const r = await run({ message: "suggest a healthcare project" }, deps);
    expect(r.result.intent).toBe("ask_project");
    expect(calls.generate).toHaveLength(1);
    expect(calls.generate[0]).toMatchObject({ k: 3, domains: ["Healthcare"], message: "suggest a healthcare project" });
    expect(r.cards).toHaveLength(3);
    expect(r.cards.every((c) => c.domain === "Healthcare" && c.kind === "generated")).toBe(true);
    expect(r.meta).toMatchObject({ source: "generated", writerOffline: false });
  });

  it('after cards, "make it easier" is refine_project, keeps Healthcare and moves to Beginner', async () => {
    const { deps, calls } = fakeDeps();
    const say = conversation(deps);
    const first = await say("suggest a healthcare project");
    const easier = await say("make it easier");
    expect(easier.result.intent).toBe("refine_project");
    const req = calls.generate[1]!;
    expect(req.domains).toEqual(["Healthcare"]);
    expect(req.levels).toEqual(["Beginner"]);
    // nothing already shown (cards or grounding) is sent again
    for (const id of [...first.cards.flatMap(coreIdsOf), ...first.meta!.grounding]) expect(req.exclude_core_ids).toContain(id);
    expect(easier.cards.every((c) => c.domain === "Healthcare" && c.level === "Beginner")).toBe(true);
    expect(easier.cards.some((c) => first.cards.some((f) => f.core_problem_id === c.core_problem_id))).toBe(false);
  });

  it('"how do I build the second one" explains card #2', async () => {
    const { deps, calls } = fakeDeps();
    const say = conversation(deps);
    const ask = await say("suggest a healthcare project");
    const r = await say("how do I build the second one?");
    expect(r.result.intent).toBe("explain_project");
    expect(r.text).toContain(ask.cards[1]!.title);
    expect(r.text).toMatch(/Weeks? 1/);
    expect(r.cards).toHaveLength(0);
    expect(calls.generate).toHaveLength(1);
  });

  it('"I know Docker now" is profile_update and adds Docker even when /intent says ask_project', async () => {
    const { deps, calls, getUpdated } = fakeDeps({ remote: { intent: "ask_project", confidence: 0.91 } });
    const r = await run({ message: "I know Docker now" }, deps);
    expect(r.result.intent).toBe("profile_update");
    expect(r.intentEv).toMatchObject({ source: "rules", override: "profile_update" });
    expect(getUpdated()).toMatchObject({ addSkills: ["Docker"] });
    expect(r.text).toMatch(/added Docker to your skills/);
    expect(calls.generate).toHaveLength(0);
  });

  it('"we have 8 weeks" is profile_update with weeks = 8', async () => {
    const { deps, getUpdated } = fakeDeps({ remote: { intent: "ask_project", confidence: 0.8 } });
    const r = await run({ message: "we have 8 weeks" }, deps);
    expect(r.result.intent).toBe("profile_update");
    expect(getUpdated()).toMatchObject({ weeks: 8 });
  });

  it("/generate timing out falls back to /recommend with the same body (k = 5)", async () => {
    const { deps, calls } = fakeDeps({ generateDown: true });
    const r = await run({ message: "suggest a healthcare project" }, deps);
    expect(calls.generate).toHaveLength(1);
    expect(calls.recommend).toHaveLength(1);
    const { k: kg, ...g } = calls.generate[0]!;
    const { k: kr, ...rec } = calls.recommend[0]!;
    expect([kg, kr]).toEqual([3, 5]);
    expect(rec).toEqual(g);
    expect(r.cards).toHaveLength(5);
    expect(r.cards.every((c) => c.kind === "catalogue" && c.domain === "Healthcare")).toBe(true);
    expect(r.meta).toMatchObject({ source: "catalogue", writerOffline: true });
  });
});

describe("chat router: more behaviour", () => {
  it("uses the model's intent when no override applies, and saves its source", async () => {
    const { deps } = fakeDeps({ remote: { intent: "general_question", confidence: 0.88 }, llm: "NLP is natural language processing." });
    const r = await run({ message: "what is NLP?" }, deps);
    expect(r.intentEv).toMatchObject({ intent: "general_question", source: "model", confidence: 0.88, override: null });
    expect(r.text).toMatch(/natural language processing/);
  });

  it("a low-confidence model answer is already general_question and is respected", async () => {
    const { deps, calls } = fakeDeps({ remote: { intent: "general_question", confidence: 0.41 } });
    const r = await run({ message: "tell me about sorting" }, deps);
    expect(r.result.intent).toBe("general_question");
    expect(calls.generate).toHaveLength(0);
  });

  it("greetings and thanks never trigger projects, whatever the model says", async () => {
    const { deps, calls } = fakeDeps({ remote: { intent: "ask_project", confidence: 0.7 } });
    expect((await run({ message: "hello!" }, deps)).result.intent).toBe("greeting");
    expect((await run({ message: "thanks a lot" }, deps)).result.intent).toBe("chitchat");
    expect(calls.generate).toHaveLength(0);
  });

  it("a new domain replaces the carried one; 'any domain' clears it", async () => {
    const { deps, calls } = fakeDeps();
    const say = conversation(deps);
    await say("suggest a healthcare project");
    await say("something in agriculture instead");
    expect(calls.generate[1]!.domains).toEqual(["Agriculture"]);
    await say("any domain is fine");
    expect(calls.generate[2]!.domains).toEqual([]);
  });

  it("404 from /generate gives the widen-the-search message", async () => {
    const { deps } = fakeDeps();
    const say = conversation(deps);
    let r = await say("suggest a healthcare project");
    for (let i = 0; i < 12 && r.cards.length; i++) r = await say("show me another");
    expect(r.text).toBe("You've seen every Healthcare idea that fits. Want to widen the domain or level?");
  });

  it("answers calmly when the ML service is down, without crashing", async () => {
    const { deps } = fakeDeps({ mlDown: true });
    const r = await run({ message: "suggest a project" }, deps);
    expect(r.result.error).toBe("ml_unavailable");
    expect(r.text).toMatch(/warming up/);
  });

  it("profile_update uses the validated LLM extraction when an LLM is available", async () => {
    const { deps, getUpdated } = fakeDeps({ extract: { addSkills: ["Kubernetes"], interests: ["Healthcare", "Fintech"] } });
    const r = await run({ message: "I learned Kubernetes and I'm into fintech too" }, deps);
    expect(r.result.intent).toBe("profile_update");
    expect(getUpdated()).toMatchObject({ addSkills: ["Kubernetes"], interests: ["Healthcare", "Fintech"] });
    expect(r.text.split(/[.!?]\s/).length).toBe(1); // confirmed in one sentence
  });

  it("never lets the LLM produce cards: cards only come from /generate or /recommend", async () => {
    const { deps } = fakeDeps({ llm: "Here are 5 projects: 1. Fake idea" });
    const r = await run({ message: "hello" }, deps);
    expect(r.events.some((e) => e.type === "cards")).toBe(false);
  });

  it("asks which card when the reference can't be resolved", async () => {
    const { deps } = fakeDeps();
    const say = conversation(deps);
    await say("suggest a project");
    const r = await say("explain this one in detail please");
    expect(r.result.intent).toBe("explain_project");
    expect(r.text).toMatch(/Which one/);
  });
});
