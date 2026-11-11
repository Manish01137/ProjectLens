import { z } from "zod";
import { BRANCHES, DOMAINS, GOALS, LEVELS, SAVED_STATUSES } from "./constants";

// ── Projects ──────────────────────────────────────────────────────────────────────────────
// One card shape for the whole UI. Catalogue projects come from /recommend; generated ideas come
// from /generate and carry the extra optional fields (see lib/cards.ts for the mapping).
export const milestoneSchema = z.object({ week: z.number().int(), task: z.string() });
export type Milestone = z.infer<typeof milestoneSchema>;

export const projectSchema = z.object({
  id: z.string(),
  core_problem_id: z.string(),
  title: z.string(),
  problem_statement: z.string(),
  domain: z.string(),
  approach: z.string(),
  project_type: z.string(),
  tech_stack: z.string(),
  level: z.string(),
  duration_weeks: z.number().nullable(),
  matched_skills: z.array(z.string()),
  match_score: z.number(),
  source: z.string(),
  // generated-idea fields (absent on catalogue projects)
  kind: z.enum(["generated", "catalogue"]).optional(),
  skills_used: z.array(z.string()).optional(),
  new_skill_to_learn: z.string().optional(),
  milestones: z.array(milestoneSchema).optional(),
  data_source: z.string().optional(),
  why_it_fits: z.string().optional(),
  target_users: z.string().optional(),
  inspired_by: z.string().optional(),
  novelty_similarity: z.number().optional(),
});
export type Project = z.infer<typeof projectSchema>;
export const projectListSchema = z.array(projectSchema);

/** Filters the ranking applied (X-Applied-Filters header / `applied` of /generate). */
export const appliedFiltersSchema = z.object({
  domains: z.array(z.string()).default([]),
  approaches: z.array(z.string()).default([]),
  levels: z.array(z.string()).default([]),
  weeks: z.number().nullable().default(null),
  hardware_ok: z.boolean().nullable().default(null),
  relaxed: z.array(z.string()).default([]),
});
export type AppliedFilters = z.infer<typeof appliedFiltersSchema>;

/** One idea from /generate: generated (all checks passed) or a catalogue fallback card. */
export const generatedIdeaSchema = z.object({
  title: z.string(),
  problem_statement: z.string(),
  domain: z.string(),
  target_users: z.string().default(""),
  skills_used: z.array(z.string()).default([]),
  new_skill_to_learn: z.string().default(""),
  tech_stack: z.array(z.string()).default([]),
  milestones: z.array(milestoneSchema).default([]),
  data_source: z.string().default(""),
  why_it_fits: z.string().default(""),
  inspired_by: z.string(),
  source: z.enum(["generated", "catalogue"]),
  checks: z.string().optional(),
  novelty_similarity: z.number().optional(),
});
export type GeneratedIdea = z.infer<typeof generatedIdeaSchema>;

export const generateResponseSchema = z.object({
  ideas: z.array(generatedIdeaSchema),
  grounding: z.array(z.string()).default([]),
  applied: appliedFiltersSchema,
  source: z.string(),
  rounds: z.number().default(0),
  rejected: z.array(z.object({ title: z.string(), problems: z.array(z.string()) })).default([]),
  llm_error: z.string().optional(),
});
export type GenerateResponse = z.infer<typeof generateResponseSchema>;

// ── Profile ───────────────────────────────────────────────────────────────────────────────
const skillName = z.string().trim().min(1).max(40);

export const aboutStepSchema = z.object({
  branch: z.enum(BRANCHES, { message: "Choose your branch" }),
  semester: z.number().int().min(1).max(8),
});

export const skillsStepSchema = z
  .object({
    skills: z.array(skillName).min(1, "Add at least one skill").max(25),
    skillLevels: z.record(z.string(), z.number().int().min(1).max(3)),
  })
  .transform((v) => ({
    skills: [...new Set(v.skills)],
    skillLevels: Object.fromEntries(Object.entries(v.skillLevels).filter(([k]) => v.skills.includes(k))),
  }));

export const interestsStepSchema = z.object({
  interests: z.array(z.enum(DOMAINS)).min(1, "Pick at least one domain").max(4, "Pick up to 4 domains"),
});

export const constraintsStepSchema = z.object({
  level: z.enum(LEVELS),
  weeks: z.number().int().min(4).max(24),
  teamSize: z.number().int().min(1).max(6),
  hardwareOk: z.boolean(),
  goal: z.enum(GOALS),
  guidePreferences: z.string().trim().max(1000).optional().default(""),
});

export const fullProfileSchema = z.object({
  ...aboutStepSchema.shape,
  skills: z.array(skillName).min(1).max(25),
  skillLevels: z.record(z.string(), z.number().int().min(1).max(3)),
  ...interestsStepSchema.shape,
  ...constraintsStepSchema.shape,
});
export type FullProfile = z.infer<typeof fullProfileSchema>;

/** PUT /api/profile: either one onboarding step or the whole profile (profile page). */
export const profileUpdateSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal(1), data: aboutStepSchema }),
  z.object({ step: z.literal(2), data: skillsStepSchema }),
  z.object({ step: z.literal(3), data: interestsStepSchema }),
  z.object({ step: z.literal(4), data: constraintsStepSchema, complete: z.boolean().optional() }),
  z.object({ step: z.literal("all"), data: fullProfileSchema }),
]);

// ── Auth ──────────────────────────────────────────────────────────────────────────────────
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Include a letter")
    .regex(/[0-9]/, "Include a number"),
});
export const loginSchema = z.object({
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Enter your password").max(128),
});

// ── API bodies ────────────────────────────────────────────────────────────────────────────
export const filtersSchema = z.object({
  domain: z.enum(DOMAINS).optional(),
  softwareOnly: z.boolean().optional(),
  maxWeeks: z.number().int().min(4).max(24).optional(),
});
export type Filters = z.infer<typeof filtersSchema>;

export const recommendBodySchema = z.object({
  message: z.string().trim().max(500).optional(),
  filters: filtersSchema.optional(),
  fresh: z.boolean().optional(), // false: return the latest dashboard batch if one exists
});

export const savedCreateSchema = z.object({ project: projectSchema, note: z.string().max(2000).optional() });
export const savedPatchSchema = z
  .object({ status: z.enum(SAVED_STATUSES).optional(), note: z.string().max(2000).optional() })
  .refine((v) => v.status !== undefined || v.note !== undefined, "Nothing to update");

export const chatBodySchema = z.object({
  chatId: z.string().min(1).max(64).optional(),
  message: z.string().trim().min(1, "Type a message").max(4000),
  regenerate: z.boolean().optional(),
});
export const chatPatchSchema = z
  .object({ title: z.string().trim().min(1).max(120).optional(), pinned: z.boolean().optional() })
  .refine((v) => v.title !== undefined || v.pinned !== undefined, "Nothing to update");

export const feedbackSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });
export const planBodySchema = z.object({ project: projectSchema });
export const dismissBodySchema = z.object({ projectId: z.string().min(1).max(64) });
