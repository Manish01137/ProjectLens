import { afterEach, describe, expect, it, vi } from "vitest";
import { __setFetch, generate, MlExhaustedError, MlInvalidProfileError, MlUnavailableError, recommend, remoteIntent } from "@/lib/ml";
import { makeProject } from "./fixtures";

const profile = { skills: ["Python"], interests: ["Healthcare"], level: "Intermediate", weeks: 12, hardware_ok: false };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => __setFetch(null));

describe("ML client", () => {
  it("parses projects with Zod", async () => {
    __setFetch(async () => json(200, [makeProject(1), makeProject(2)]));
    const r = await recommend({ profile });
    expect(r.projects).toHaveLength(2);
    expect(r.exhausted).toBe(false);
  });

  it("sends the seen list and defaults k to 5", async () => {
    const spy = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => json(200, [makeProject(1)]));
    __setFetch(spy as unknown as typeof fetch);
    await recommend({ profile, exclude_core_ids: ["H-03"] });
    const body = JSON.parse(String(spy.mock.calls[0]![1]!.body));
    expect(body).toMatchObject({ k: 5, exclude_core_ids: ["H-03"] });
  });

  it("treats 404 as 'no projects left'", async () => {
    __setFetch(async () => json(404, { detail: "none" }));
    await expect(recommend({ profile })).resolves.toEqual({ projects: [], exhausted: true, applied: null });
  });

  it("maps 422 to MlInvalidProfileError", async () => {
    __setFetch(async () => json(422, { detail: [] }));
    await expect(recommend({ profile })).rejects.toBeInstanceOf(MlInvalidProfileError);
  });

  it("maps 5xx and malformed responses to MlUnavailableError", async () => {
    __setFetch(async () => json(503, { detail: "no model" }));
    await expect(recommend({ profile })).rejects.toBeInstanceOf(MlUnavailableError);
    __setFetch(async () => json(200, [{ id: 1 }]));
    await expect(recommend({ profile })).rejects.toBeInstanceOf(MlUnavailableError);
  });

  it("retries once on a network error, then gives up calmly", async () => {
    let calls = 0;
    __setFetch(async () => {
      calls++;
      throw new TypeError("fetch failed");
    });
    await expect(recommend({ profile })).rejects.toBeInstanceOf(MlUnavailableError);
    expect(calls).toBe(2);

    calls = 0;
    __setFetch(async () => {
      calls++;
      if (calls === 1) throw new TypeError("fetch failed");
      return json(200, [makeProject(3)]);
    });
    await expect(recommend({ profile })).resolves.toMatchObject({ projects: [{ id: makeProject(3).id }] });
  });

  it("does not retry a timeout", async () => {
    let calls = 0;
    __setFetch(async () => {
      calls++;
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(recommend({ profile })).rejects.toThrow(/timed out/);
    expect(calls).toBe(1);
  });

  it("reads the applied filters from the X-Applied-Filters header", async () => {
    const applied = { domains: ["Healthcare"], approaches: [], levels: ["Beginner"], weeks: 12, hardware_ok: false, relaxed: ["level"] };
    __setFetch(async () => new Response(JSON.stringify([makeProject(1)]), { status: 200, headers: { "x-applied-filters": JSON.stringify(applied) } }));
    const r = await recommend({ profile, domains: ["Healthcare"] });
    expect(r.applied).toEqual(applied);
    expect(r.projects[0]!.kind).toBe("catalogue");
  });

  it("/generate: parses ideas, maps 404 to MlExhaustedError and a timeout to MlUnavailableError", async () => {
    const body = {
      ideas: [{ title: "T", problem_statement: "P", domain: "Healthcare", inspired_by: "H-01", source: "generated", novelty_similarity: 0.7 }],
      grounding: ["H-01", "H-02"],
      applied: { domains: ["Healthcare"], approaches: [], levels: [], weeks: 12, hardware_ok: false, relaxed: [] },
      source: "generated",
      rounds: 1,
      rejected: [{ title: "X", problems: ["too close"] }],
    };
    let sent: Record<string, unknown> = {};
    __setFetch((async (_u: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return json(200, body);
    }) as unknown as typeof fetch);
    const g = await generate({ profile, message: "suggest a healthcare project", exclude_core_ids: ["H-09"] });
    expect(sent).toMatchObject({ k: 3, exclude_core_ids: ["H-09"] });
    expect(g.ideas[0]).toMatchObject({ title: "T", skills_used: [], milestones: [], novelty_similarity: 0.7 });
    expect(g.rejected).toHaveLength(1);

    __setFetch(async () => new Response("{}", { status: 404, headers: { "x-applied-filters": JSON.stringify(body.applied) } }));
    const err = await generate({ profile }).catch((e) => e);
    expect(err).toBeInstanceOf(MlExhaustedError);
    expect((err as MlExhaustedError).applied?.domains).toEqual(["Healthcare"]);

    __setFetch(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(generate({ profile })).rejects.toBeInstanceOf(MlUnavailableError);
  });

  it("uses the intent field (not raw_intent) from /intent", async () => {
    __setFetch(async () => json(200, { intent: "general_question", confidence: 0.42, raw_intent: "ask_project", low_confidence: true }));
    await expect(remoteIntent("hmm")).resolves.toEqual({ intent: "general_question", confidence: 0.42 });
  });

  it("returns null from /intent on 501 so the rules take over", async () => {
    __setFetch(async () => json(501, { detail: "not trained" }));
    await expect(remoteIntent("hi")).resolves.toBeNull();
    __setFetch(async () => json(200, { intent: "greeting", confidence: 0.93 }));
    await expect(remoteIntent("hi")).resolves.toEqual({ intent: "greeting", confidence: 0.93 });
  });
});
