// profile_update: the LLM extracts a JSON change set, which is validated here before anything is
// saved. When no LLM is reachable (or it returns nothing usable), the regex rules in understand.ts
// are used instead.
import { z } from "zod";
import { DOMAIN_ALIASES, DOMAINS, LEVELS, type Domain } from "../constants";
import type { ProfilePatch } from "./understand";

export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    skills_add: { type: "array", items: { type: "string" } },
    skills_remove: { type: "array", items: { type: "string" } },
    interests_add: { type: "array", items: { type: "string" } },
    interests_remove: { type: "array", items: { type: "string" } },
    weeks: { type: ["integer", "null"] },
    team_size: { type: ["integer", "null"] },
    level: { type: ["string", "null"] },
    hardware_ok: { type: ["boolean", "null"] },
  },
  required: ["skills_add", "skills_remove", "interests_add", "interests_remove", "weeks", "team_size", "level", "hardware_ok"],
} as const;

export const EXTRACT_SYSTEM = `You extract profile changes from ONE message a B.Tech student wrote about themselves.
Return JSON only with these keys:
skills_add, skills_remove: technologies or skills they now have / no longer have (short names like "Docker", "Flutter").
interests_add, interests_remove: only these exact domain names: ${DOMAINS.join("; ")}.
weeks: weeks available for the project (integer) or null. team_size: integer or null.
level: "Beginner" | "Intermediate" | "Advanced" or null. hardware_ok: true/false or null.
Only include what the message actually states. Use [] or null for everything else. Never guess.`;

const skill = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(40));
const skillList = z
  .array(z.unknown())
  .catch([])
  .transform((xs) => [...new Set(xs.flatMap((x) => (skill.safeParse(x).success ? [skill.parse(x)] : [])))].slice(0, 10));
const domainList = z
  .array(z.unknown())
  .catch([])
  // Domains must be one of the 12 exact names; anything else is dropped.
  .transform((xs) => xs.filter((x): x is Domain => typeof x === "string" && (DOMAINS as readonly string[]).includes(x.trim())).map((x) => x.trim() as Domain));
const nullableInt = (min: number, max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null));

const extractionSchema = z.object({
  skills_add: skillList,
  skills_remove: skillList,
  interests_add: domainList,
  interests_remove: domainList,
  weeks: nullableInt(4, 24),
  team_size: nullableInt(1, 6),
  level: z.unknown().transform((v) => (typeof v === "string" && (LEVELS as readonly string[]).includes(v) ? (v as (typeof LEVELS)[number]) : null)),
  hardware_ok: z.unknown().transform((v) => (typeof v === "boolean" ? v : null)),
});

// Small models sometimes fill fields the student never mentioned ("I know Docker now" → level
// "Advanced"). A field is only accepted when the message itself carries evidence for it.
const EVIDENCE = {
  weeks: /\b\d{1,2}\s*(weeks?|wks?|months?)\b/i,
  team: /\b(team|people|members|of us|alone|solo|by myself|partner)\b/i,
  level: /\b(beginner|intermediate|advanced|newbie|expert|level)\b/i,
  hardware: /\b(hardware|arduino|sensors?|iot|raspberry|esp32|electronics|embedded)\b/i,
};

function mentions(text: string, term: string): boolean {
  const t = text.toLowerCase();
  const w = term.toLowerCase().trim();
  return w.length > 0 && (t.includes(w) || t.includes(w.replace(/[.\s-]+/g, "")));
}

function mentionsDomain(text: string, d: Domain): boolean {
  return mentions(text, d) || DOMAIN_ALIASES[d].some((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

/**
 * Validates the LLM's JSON against the student's current profile and the message it came from.
 * Null when nothing valid remains.
 */
export function validateExtraction(raw: unknown, current: { skills: string[]; interests: string[] }, text?: string): ProfilePatch | null {
  const parsed = extractionSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!parsed.success) return null;
  const e = parsed.data;
  if (text !== undefined) {
    e.skills_add = e.skills_add.filter((s) => mentions(text, s));
    e.skills_remove = e.skills_remove.filter((s) => mentions(text, s));
    e.interests_add = e.interests_add.filter((d) => mentionsDomain(text, d));
    e.interests_remove = e.interests_remove.filter((d) => mentionsDomain(text, d));
    if (!EVIDENCE.weeks.test(text)) e.weeks = null;
    if (!EVIDENCE.team.test(text) && !/\bwe are \d/i.test(text)) e.team_size = null;
    if (!EVIDENCE.level.test(text)) e.level = null;
    if (!EVIDENCE.hardware.test(text)) e.hardware_ok = null;
  }
  const have = new Set(current.skills.map((s) => s.toLowerCase()));
  const patch: ProfilePatch = {};
  const add = e.skills_add.filter((s) => !have.has(s.toLowerCase()));
  const remove = current.skills.filter((s) => e.skills_remove.some((r) => r.toLowerCase() === s.toLowerCase()));
  if (add.length) patch.addSkills = add;
  if (remove.length) patch.removeSkills = remove;
  if (e.interests_add.length || e.interests_remove.length) {
    const next = [...new Set([...current.interests.filter((i) => !e.interests_remove.includes(i as Domain)), ...e.interests_add])];
    if (next.length >= 1 && next.length <= 4 && next.join("|") !== current.interests.join("|")) patch.interests = next as Domain[];
  }
  if (e.weeks !== null) patch.weeks = e.weeks;
  if (e.team_size !== null) patch.teamSize = e.team_size;
  if (e.level !== null) patch.level = e.level;
  if (e.hardware_ok !== null) patch.hardwareOk = e.hardware_ok;
  return Object.keys(patch).length ? patch : null;
}
