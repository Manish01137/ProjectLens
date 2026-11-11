import type { StudentProfile } from "./profile";

const GOAL_QUESTION: Record<string, string> = {
  Placement: "Which project types impress recruiters most?",
  Research: "How do I turn a project into a paper?",
  Startup: "How do I validate a project idea with real users?",
  Hackathon: "How do I scope a project for a 36-hour hackathon?",
};

/** Four starter prompts built from the student's profile. */
export function suggestionsFor(p: StudentProfile): string[] {
  const [i1, i2] = p.interests;
  const [s1, s2] = p.skills;
  const out = [
    `Suggest a ${(i1 ?? "healthcare").toLowerCase()} project using ${s1 ?? "Python"}`,
    i2 ? `Something in ${i2.toLowerCase()} I can finish in ${p.weeks} weeks` : `A project I can finish in ${p.weeks} weeks`,
    s2 ? `What should I learn alongside ${s2}?` : "What is retrieval-augmented generation?",
    GOAL_QUESTION[p.goal] ?? GOAL_QUESTION.Placement!,
  ];
  return out;
}
