import type { Project, GenerateResponse, AppliedFilters } from "@/lib/validators";
import type { ChatProfile, ProjectRequest, RouterDeps } from "@/lib/chat/router";
import { DOMAINS, LEVELS } from "@/lib/constants";

export function makeProject(i: number, over: Partial<Project> = {}): Project {
  const domain = DOMAINS[i % DOMAINS.length]!;
  return {
    id: `PS${String(i).padStart(5, "0")}`,
    core_problem_id: `CP-${i}`,
    title: `Project number ${i} about ${domain.toLowerCase()}`,
    problem_statement: `Problem statement ${i}.`,
    domain,
    approach: "Machine Learning",
    project_type: "Software",
    tech_stack: "Python, scikit-learn, FastAPI, React",
    level: LEVELS[i % 3]!,
    duration_weeks: 12,
    matched_skills: ["Python"],
    match_score: 0.7 - i / 1000,
    source: "test",
    ...over,
  };
}

export const profile: ChatProfile = {
  name: "Manish Kumar",
  branch: "CSE",
  semester: 7,
  skills: ["Python", "React"],
  interests: ["Healthcare"],
  level: "Intermediate",
  weeks: 12,
  hardwareOk: false,
  goal: "Placement",
};

export class FakeUnavailable extends Error {}
export class FakeExhausted extends Error {
  constructor(public applied: AppliedFilters) {
    super("404");
  }
}

const appliedFor = (req: ProjectRequest): AppliedFilters => ({
  domains: req.domains ?? [],
  approaches: req.approaches ?? [],
  levels: req.levels ?? [],
  weeks: req.profile.weeks,
  hardware_ok: req.profile.hardware_ok,
  relaxed: [],
});

/**
 * In-memory fake of the ML service. Like the real one it honours domains, levels and
 * exclude_core_ids, and returns grounding ids with each /generate answer.
 */
export function fakeDeps(
  opts: { llm?: string | null; mlDown?: boolean; generateDown?: boolean; remote?: { intent: string; confidence: number } | null; extract?: unknown } = {},
) {
  const catalogue = Array.from({ length: 240 }, (_, i) => makeProject(i + 1));
  const calls = { generate: [] as ProjectRequest[], recommend: [] as ProjectRequest[], shown: [] as Project[][] };
  let updated: unknown = null;

  const pick = (req: ProjectRequest, k: number) =>
    catalogue
      .filter((c) => !req.exclude_core_ids.includes(c.core_problem_id))
      .filter((c) => !req.domains?.length || req.domains.includes(c.domain))
      .filter((c) => !req.levels?.length || req.levels.includes(c.level))
      .slice(0, k);

  const deps: RouterDeps = {
    remoteIntent: async () => opts.remote ?? null, // null: like a 501 from /intent
    understand: async () => null, // exercise the local fallback (mirrors ranking.py)
    async generate(req) {
      calls.generate.push(structuredClone(req));
      if (opts.mlDown || opts.generateDown) throw new FakeUnavailable("timeout");
      const refs = pick(req, req.k + 2);
      if (!refs.length) throw new FakeExhausted(appliedFor(req));
      const res: GenerateResponse = {
        ideas: refs.slice(0, req.k).map((r) => ({
          title: `New idea inspired by ${r.title}`,
          problem_statement: "Who has the problem, what goes wrong, what to build, how success is measured.",
          domain: r.domain,
          target_users: "ASHA workers",
          skills_used: ["Python", "React"],
          new_skill_to_learn: "FastAPI",
          tech_stack: ["Python", "React", "FastAPI"],
          milestones: [
            { week: 2, task: "Survey users" },
            { week: req.profile.weeks, task: "Demo" },
          ],
          data_source: "collect with a survey",
          why_it_fits: "Uses your Python and React",
          inspired_by: r.core_problem_id,
          source: "generated",
          checks: "passed",
          novelty_similarity: 0.71,
        })),
        grounding: refs.map((r) => r.core_problem_id),
        applied: appliedFor(req),
        source: "generated",
        rounds: 1,
        rejected: [],
      };
      return res;
    },
    async recommend(req) {
      calls.recommend.push(structuredClone(req));
      if (opts.mlDown) throw new FakeUnavailable("down");
      const out = pick(req, req.k);
      return { projects: out, exhausted: out.length === 0, applied: appliedFor(req) };
    },
    async recordShown(cards) {
      calls.shown.push(cards);
    },
    async updateProfile(patch) {
      updated = patch;
      return profile;
    },
    extractProfile: async () => (opts.extract as never) ?? null, // null: no LLM, rules decide
    async *stream() {
      if (opts.llm == null) throw new Error("no llm");
      for (const w of opts.llm.split(" ")) yield `${w} `;
    },
    isMlUnavailable: (e) => e instanceof FakeUnavailable,
    exhaustedApplied: (e) => (e instanceof FakeExhausted ? e.applied : undefined),
    wordDelayMs: 0,
  };
  return { deps, calls, getUpdated: () => updated };
}
