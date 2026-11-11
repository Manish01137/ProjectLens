// Week-by-week plan scaffolding. The structure (phases sized to the student's weeks, skills to
// learn, first steps) is computed here; the LLM only writes it up more naturally when available.
import type { Project } from "./validators";

export type PlanPhase = { from: number; to: number; title: string; tasks: string[] };
export type PlanOutline = { weeks: number; phases: PlanPhase[]; skillsToLearn: string[]; firstSteps: string[] };

const PHASES: { share: number; title: string; tasks: (p: Project) => string[] }[] = [
  {
    share: 0.15,
    title: "Understand the problem",
    tasks: (p) => [
      `Read 3–5 papers or articles on "${p.title}" and note what existing solutions miss`,
      "Talk to one real user or domain expert and write down their pain points",
      "Write a one-page scope: users, must-have features, what you will not build",
    ],
  },
  {
    share: 0.15,
    title: "Set up data and tools",
    tasks: (p) => [
      p.approach.toLowerCase().includes("learning") || p.approach.toLowerCase().includes("vision") || p.approach.toLowerCase().includes("nlp")
        ? "Find or collect a dataset, clean it and make a small labelled test set"
        : "Collect sample inputs and design the data model",
      `Set up the repo, environment and CI for ${firstStack(p) || "your stack"}`,
      "Build a throwaway prototype of the riskiest part",
    ],
  },
  {
    share: 0.4,
    title: "Build the core",
    tasks: (p) => [
      p.project_type === "Hardware" || p.project_type === "Hybrid"
        ? "Assemble and test the hardware on a breadboard, then integrate the sensors"
        : "Implement the main pipeline end to end, even if rough",
      p.approach.toLowerCase().includes("learning")
        ? "Train a baseline model, then improve it and track metrics in a table"
        : "Add the key features one at a time, each with a quick test",
      "Show a working demo to your guide and adjust the scope",
    ],
  },
  {
    share: 0.15,
    title: "Integrate and test",
    tasks: () => [
      "Connect all parts behind a simple interface",
      "Test with real users or realistic data; fix the top issues",
      "Measure results against the goals in your scope",
    ],
  },
  {
    share: 0.15,
    title: "Polish, report and demo",
    tasks: () => [
      "Write the report: problem, related work, design, results, limitations",
      "Record a 3-minute demo video and prepare the viva slides",
      "Clean up the code and README so anyone can run it",
    ],
  },
];

function firstStack(p: Project) {
  return p.tech_stack.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 2).join(" + ");
}

export function splitWeeks(weeks: number, shares: number[]): [number, number][] {
  const total = Math.max(shares.length, Math.round(weeks));
  const raw = shares.map((s) => s * total);
  const sizes = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = total - sizes.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; diff > 0; k = (k + 1) % order.length, diff--) sizes[order[k]![1]]!++;
  for (let i = sizes.length - 1; diff < 0; i = (i - 1 + sizes.length) % sizes.length) {
    if (sizes[i]! > 1) {
      sizes[i]!--;
      diff++;
    }
  }
  const out: [number, number][] = [];
  let start = 1;
  for (const s of sizes) {
    out.push([start, start + s - 1]);
    start += s;
  }
  return out;
}

export function buildPlanOutline(project: Project, profile: { weeks: number; skills: string[] }): PlanOutline {
  const weeks = Math.max(4, Math.min(24, profile.weeks));
  // With fewer weeks than phases, testing and polish share the final stretch.
  const defs =
    weeks >= PHASES.length
      ? PHASES
      : [
          ...PHASES.slice(0, 3),
          {
            share: 0.3,
            title: "Test, polish and demo",
            tasks: (p: Project) => [...PHASES[3]!.tasks(p).slice(0, 2), ...PHASES[4]!.tasks(p).slice(0, 2)],
          },
        ];
  const ranges = splitWeeks(weeks, defs.map((p) => p.share));
  const phases = defs.map((ph, i) => ({ from: ranges[i]![0], to: ranges[i]![1], title: ph.title, tasks: ph.tasks(project) }));
  const known = new Set(profile.skills.map((s) => s.toLowerCase()));
  const skillsToLearn = project.tech_stack
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter((s) => s && !known.has(s.toLowerCase()))
    .slice(0, 6);
  const firstSteps = [
    `Write the problem in your own words and share it with your guide this week`,
    skillsToLearn.length
      ? `Spend two evenings on a starter tutorial for ${skillsToLearn[0]}`
      : `Set up a repo with a README describing the scope`,
    `List the data or inputs you need for "${project.title}" and where you will get them`,
  ];
  return { weeks, phases, skillsToLearn, firstSteps };
}

const weekLabel = (a: number, b: number) => (a === b ? `Week ${a}` : `Weeks ${a}–${b}`);

export function planToMarkdown(project: Project, outline: PlanOutline): string {
  const lines = [`### ${outline.weeks}-week plan for ${project.title}`, ""];
  for (const ph of outline.phases) {
    lines.push(`**${weekLabel(ph.from, ph.to)}: ${ph.title}**`);
    for (const t of ph.tasks) lines.push(`- ${t}`);
    lines.push("");
  }
  lines.push("**Skills to learn**");
  lines.push(outline.skillsToLearn.length ? outline.skillsToLearn.map((s) => `- ${s}`).join("\n") : "- You already know the core stack. Go deeper on testing and deployment.");
  lines.push("", "**First steps**");
  outline.firstSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join("\n");
}

export function projectToText(p: Project): string {
  return [
    p.title,
    "",
    `Domain: ${p.domain} · Approach: ${p.approach} · Type: ${p.project_type} · Level: ${p.level}` +
      (p.duration_weeks ? ` · ${p.duration_weeks} weeks` : ""),
    "",
    p.problem_statement,
    "",
    `Tech stack: ${p.tech_stack}`,
    p.matched_skills.length ? `Uses your skills: ${p.matched_skills.join(", ")}` : "",
    `Reference: ${p.id} (${p.source})`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
