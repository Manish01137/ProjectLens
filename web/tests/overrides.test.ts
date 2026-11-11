import { describe, expect, it } from "vitest";
import { applyOverrides, isProfileStatement } from "@/lib/chat/overrides";
import { decideIntent } from "@/lib/chat/intent";
import { mergeFilters, understandLocally, type CarriedFilters } from "@/lib/chat/carry";
import { validateExtraction } from "@/lib/chat/profile-extract";

const none = { lastTurnHadCards: false, hasCards: false };
const afterCards = { lastTurnHadCards: true, hasCards: true };

describe("safety overrides (applied after the model, in order)", () => {
  it.each([
    "I know Docker now",
    "I learnt Flutter last month",
    "I have learned Kubernetes",
    "I have experience with GIS",
    "my skills are Python, SQL and React",
    "we have 8 weeks",
    "I only have 10 weeks",
    "my team is 3",
    "we are 4 people",
    "I'm a beginner",
    "I am advanced",
    "add Docker to my skills",
    "remove Java from my skills",
    "I'm fine with hardware",
    "I'm not fine with hardware",
  ])("%s → profile_update", (t) => {
    expect(applyOverrides(t, none)?.intent).toBe("profile_update");
    // even when the model is confident it's a project request
    expect(decideIntent(t, none, { intent: "ask_project", confidence: 0.97 }).intent).toBe("profile_update");
  });

  it.each(["I know React, suggest a project", "I have 8 weeks, give me some ideas", "I know Python, recommend something", "we have 8 weeks, any projects in fintech?"])(
    "%s → not a pure profile statement (contains a request)",
    (t) => expect(isProfileStatement(t)).toBe(false),
  );

  it.each(["make it easier", "something harder", "show more", "another one", "different ones please", "without hardware", "use Flutter instead", "next"])(
    "%s right after cards → refine_project",
    (t) => {
      expect(applyOverrides(t, afterCards)?.intent).toBe("refine_project");
      expect(decideIntent(t, afterCards, { intent: "general_question", confidence: 0.9 }).intent).toBe("refine_project");
    },
  );

  it("refine needs cards in the last turn and at most 6 words", () => {
    expect(applyOverrides("make it easier", { lastTurnHadCards: false, hasCards: true })).toBeNull();
    expect(applyOverrides("can you make the whole thing a bit easier for me", afterCards)?.intent).not.toBe("refine_project");
  });

  it.each(["how do I build the second one?", "explain the first one", "what dataset for the 3rd?", "plan for the last one", "steps for that one"])(
    "%s → explain_project",
    (t) => expect(applyOverrides(t, afterCards)?.intent).toBe("explain_project"),
  );

  it("a card reference with 'more' is an explanation, not a refinement", () => {
    expect(applyOverrides("explain the second one more", afterCards)?.intent).toBe("explain_project");
  });

  it.each([
    ["hi", "greeting"],
    ["hello!", "greeting"],
    ["good evening", "greeting"],
    ["thanks", "chitchat"],
    ["thank you so much!", "chitchat"],
  ])("%s → %s (never projects)", (t, intent) => {
    expect(decideIntent(t, afterCards, { intent: "ask_project", confidence: 0.8 }).intent).toBe(intent);
  });

  it("records the override and marks the source as rules", () => {
    expect(decideIntent("I know Docker now", none, { intent: "ask_project", confidence: 0.9 })).toMatchObject({
      intent: "profile_update",
      source: "rules",
      override: "profile_update",
    });
    expect(decideIntent("what is NLP?", none, { intent: "general_question", confidence: 0.9 })).toMatchObject({ source: "model", override: null });
  });

  it("falls back to the rules when /intent is unavailable", () => {
    expect(decideIntent("suggest a healthcare project", none, null)).toMatchObject({ intent: "ask_project", source: "rules" });
  });
});

describe("context carry-over", () => {
  const prev: CarriedFilters = { domains: ["Healthcare"], approaches: [], levels: [], weeks: 12, hardware_ok: false };
  it('"make it easier" keeps Healthcare and moves to Beginner', () => {
    expect(mergeFilters(prev, understandLocally("make it easier", "Intermediate"), "make it easier")).toMatchObject({
      domains: ["Healthcare"],
      levels: ["Beginner"],
      weeks: 12,
      hardware_ok: false,
    });
  });
  it("a new domain replaces the old one, 'any domain' clears it", () => {
    expect(mergeFilters(prev, understandLocally("try agriculture", "Intermediate"), "try agriculture").domains).toEqual(["Agriculture"]);
    expect(mergeFilters(prev, understandLocally("any domain is fine", "Intermediate"), "any domain is fine").domains).toEqual([]);
  });
  it("harder steps up from the carried level", () => {
    expect(understandLocally("harder", "Beginner").levels).toEqual(["Intermediate", "Advanced"]);
    expect(understandLocally("make it easier", "Beginner").levels).toEqual(["Beginner"]);
  });
});

describe("profile_update extraction is validated", () => {
  const current = { skills: ["Python", "React"], interests: ["Healthcare"] };
  it("keeps valid changes and trims skills", () => {
    expect(
      validateExtraction(
        { skills_add: ["  Docker "], skills_remove: [], interests_add: ["Fintech"], interests_remove: [], weeks: 8, team_size: null, level: null, hardware_ok: null },
        current,
      ),
    ).toEqual({ addSkills: ["Docker"], interests: ["Healthcare", "Fintech"], weeks: 8 });
  });
  it("drops domains that are not one of the 12 exact names, and out-of-range numbers", () => {
    expect(
      validateExtraction(
        { skills_add: [], skills_remove: [], interests_add: ["finance", "Health care"], interests_remove: [], weeks: 60, team_size: 12, level: "Expert", hardware_ok: "yes" },
        current,
      ),
    ).toBeNull();
  });
  it("ignores skills the student already has and removes only ones they have", () => {
    expect(
      validateExtraction(
        { skills_add: ["python"], skills_remove: ["React", "Rust"], interests_add: [], interests_remove: [], weeks: null, team_size: null, level: "Beginner", hardware_ok: true },
        current,
      ),
    ).toEqual({ removeSkills: ["React"], level: "Beginner", hardwareOk: true });
  });
  it("drops fields the message gives no evidence for (small models over-fill)", () => {
    // Seen live with qwen2.5:3b: "I know Docker now" came back with level "Advanced" as well.
    const llm = { skills_add: ["Docker"], skills_remove: [], interests_add: ["Fintech"], interests_remove: [], weeks: 12, team_size: 3, level: "Advanced", hardware_ok: true };
    expect(validateExtraction(llm, current, "I know Docker now")).toEqual({ addSkills: ["Docker"] });
    expect(validateExtraction({ ...llm, skills_add: ["Kubernetes"] }, current, "I know Docker now")).toBeNull();
    expect(validateExtraction(llm, current, "we have 12 weeks and I'm advanced now")).toEqual({ weeks: 12, level: "Advanced" });
    expect(validateExtraction(llm, current, "I learned Docker and want fintech projects, team of 3, hardware is fine")).toEqual({
      addSkills: ["Docker"],
      interests: ["Healthcare", "Fintech"],
      teamSize: 3,
      hardwareOk: true,
    });
  });
  it("survives malformed JSON", () => {
    expect(validateExtraction(null, current)).toBeNull();
    expect(validateExtraction({ skills_add: "Docker" }, current)).toBeNull();
  });
});
