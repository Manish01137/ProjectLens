import type { Project } from "../validators";
import type { PlanOutline } from "../plan";

type P = { name: string; branch: string | null; semester: number | null; skills: string[]; interests: string[]; level: string; weeks: number; goal: string };

export function systemPrompt(p: P): string {
  return [
    "You are the ProjectLens assistant. You help final-year B.Tech students in India choose and plan their final-year project,",
    "and you answer their engineering and computer-science questions like a patient, knowledgeable tutor.",
    "",
    `Student: ${p.name.trim().split(/\s+/)[0] || "the student"}${p.branch ? `, ${p.branch}` : ""}${p.semester ? `, semester ${p.semester}` : ""}. Level: ${p.level}.`,
    `Skills: ${p.skills.join(", ") || "not given"}. Interests: ${p.interests.join(", ") || "not given"}. Time: ${p.weeks} weeks. Goal: ${p.goal}.`,
    "",
    "Rules:",
    "- Answer exactly what was asked. Be concise: a few short paragraphs or a short list. Use markdown when it helps.",
    "- Be honest. If you are not sure, say \"I'm not sure\" and suggest how to find out. Never invent facts, citations or links.",
    "- Never invent project ideas, titles, IDs or catalogue entries. Project cards come only from the ProjectLens model.",
    "  If the student wants project ideas, tell them to ask (for example \"suggest a healthcare project\") and you will fetch matches.",
    "- Stay on topic: projects, engineering, programming, careers, studying. Politely steer away from unrelated requests.",
    "- Warm and calm tone. No emojis unless the student uses them.",
  ].join("\n");
}

export const greetingInstruction =
  "Reply in at most 2 short sentences (under 35 words). Greet the student by first name only and offer to find or plan a project. Do not list projects, skills or ideas.";
export const chitchatInstruction =
  "Reply in at most 2 short, friendly sentences (under 35 words). Do not list or suggest specific projects.";

export function explainInstruction(project: Project, outline: PlanOutline, index: number, skills: string[] = []): string {
  const ranges = outline.phases.map((ph) => `- Weeks ${ph.from}-${ph.to}: ${ph.title} (${ph.tasks.join("; ")})`).join("\n");
  const milestones = project.milestones?.length
    ? `\nThe card already sketches these milestones (adapt them, keep within ${outline.weeks} weeks):\n${project.milestones
        .map((m) => `- Week ${m.week}: ${m.task}`)
        .join("\n")}`
    : "";
  return [
    `The student asked how to build project #${index + 1} from the cards shown earlier.`,
    "",
    `Project: ${project.title}`,
    `Problem: ${project.problem_statement}`,
    `Domain: ${project.domain}.${project.approach ? ` Approach: ${project.approach}.` : ""} Tech stack: ${project.tech_stack}.`,
    project.data_source ? `Data source: ${project.data_source}.` : "Data source: not given; suggest a real, reachable one or say to collect it.",
    `Student's skills: ${skills.join(", ") || "not given"}.${project.new_skill_to_learn ? ` New skill to learn: ${project.new_skill_to_learn}.` : ""}`,
    milestones,
    "",
    `Write a week-by-week plan for exactly ${outline.weeks} weeks, using these phases (keep the week ranges):`,
    ranges,
    "",
    `Use the student's skills and this tech stack, and say where the data comes from. Then a "Skills to learn" list (${
      outline.skillsToLearn.join(", ") || "deepen what they know"
    }) and 3 concrete "First steps" for this week.`,
    "Make every task specific to this project. Start with a level-3 heading (###) naming the project. Keep it under 350 words.",
  ].join("\n");
}
