import { describe, expect, it } from "vitest";
import {
  applyRefinement,
  extractProfileUpdate,
  findDomains,
  findSkills,
  resolveCardReference,
  titleFromMessage,
} from "@/lib/chat/understand";
import { buildPlanOutline, splitWeeks } from "@/lib/plan";
import { applyFilters, postFilter } from "@/lib/filters";
import { makeProject } from "./fixtures";

const base = { skills: ["Python"], interests: ["Healthcare"], level: "Intermediate" as const, weeks: 12, hardwareOk: true };

describe("understanding messages", () => {
  it("finds skills and domains", () => {
    expect(findSkills("I want to use flutter and node js")).toEqual(expect.arrayContaining(["Flutter", "Node.js"]));
    expect(findSkills("suggest the next one")).toEqual([]);
    expect(findDomains("something for farmers")).toEqual(["Agriculture"]);
    expect(findDomains("a healthcare project")).toEqual(["Healthcare"]);
  });

  it("extracts profile updates", () => {
    expect(extractProfileUpdate("I also know Docker now", { skills: ["Python"], interests: [] })).toEqual({ addSkills: ["Docker"] });
    expect(extractProfileUpdate("I only have 8 weeks", { skills: [], interests: [] })).toEqual({ weeks: 8 });
    expect(extractProfileUpdate("we are 4 people now", { skills: [], interests: [] })).toEqual({ teamSize: 4 });
    expect(extractProfileUpdate("I can't use hardware", { skills: [], interests: [] })).toEqual({ hardwareOk: false });
    expect(extractProfileUpdate("I learned Godot", { skills: [], interests: [] })).toEqual({ addSkills: ["Godot"] });
    expect(extractProfileUpdate("hello", { skills: [], interests: [] })).toBeNull();
  });

  it("applies refinements to the query, not the stored profile", () => {
    expect(applyRefinement("make it easier", base).profile.level).toBe("Beginner");
    expect(applyRefinement("harder", base).profile.level).toBe("Advanced");
    expect(applyRefinement("use Flutter instead", base).profile.skills[0]).toBe("Flutter");
    expect(applyRefinement("something in agriculture", base).profile.interests).toEqual(["Agriculture"]);
    expect(applyRefinement("no hardware please", base).profile.hardwareOk).toBe(false);
    expect(applyRefinement("in 6 weeks", base).profile.weeks).toBe(6);
  });

  it("resolves which card the student means", () => {
    const cards = [1, 2, 3, 4, 5].map((i) => makeProject(i));
    expect(resolveCardReference("explain the second one", cards)).toBe(1);
    expect(resolveCardReference("how do I build #4", cards)).toBe(3);
    expect(resolveCardReference("the last one", cards)).toBe(4);
    expect(resolveCardReference("number 3 please", cards)).toBe(2);
    expect(resolveCardReference("the sixth one", cards)).toBeNull();
    expect(resolveCardReference("explain it", cards.slice(0, 1))).toBe(0);
  });

  it("makes short chat titles", () => {
    expect(titleFromMessage("suggest a healthcare project using python please and thanks")).toBe("Suggest a healthcare project using python please");
    expect(titleFromMessage("hi")).toBe("Hi");
  });
});

describe("plans", () => {
  it("splits weeks across phases, covering every week exactly once", () => {
    for (const w of [4, 5, 8, 12, 16, 24]) {
      const r = splitWeeks(w, [0.15, 0.15, 0.4, 0.15, 0.15]);
      expect(r[0]![0]).toBe(1);
      expect(r[r.length - 1]![1]).toBe(w < 5 ? 5 : w);
    }
  });
  it("sizes the plan to the student's weeks and lists skills to learn", () => {
    const o = buildPlanOutline(makeProject(1), { weeks: 8, skills: ["Python"] });
    expect(o.phases[o.phases.length - 1]!.to).toBe(8);
    expect(o.skillsToLearn).toContain("FastAPI");
    expect(o.skillsToLearn).not.toContain("Python");
    const short = buildPlanOutline(makeProject(1), { weeks: 4, skills: [] });
    expect(short.phases).toHaveLength(4);
    expect(short.phases[3]!.to).toBe(4);
  });
});

describe("dashboard filters", () => {
  it("steer the query and post-filter exactly", () => {
    const { query, message } = applyFilters(base, "", { domain: "Fintech", softwareOnly: true, maxWeeks: 8 });
    expect(query).toMatchObject({ interests: ["Fintech"], hardwareOk: false, weeks: 8 });
    expect(message).toContain("Fintech");
    const items = [
      makeProject(1, { domain: "Fintech", duration_weeks: 8 }),
      makeProject(2, { domain: "Fintech", duration_weeks: 12 }),
      makeProject(3, { domain: "Fintech", project_type: "Hardware", duration_weeks: 6 }),
      makeProject(4, { domain: "Healthcare", duration_weeks: 6 }),
    ];
    expect(postFilter(items, { domain: "Fintech", softwareOnly: true, maxWeeks: 8 }).map((p) => p.id)).toEqual([items[0]!.id]);
  });
});
