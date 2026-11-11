// Small, testable helpers that turn a chat message into structured changes.
import { DOMAIN_ALIASES, DOMAINS, LEVELS, SKILL_SUGGESTIONS, type Domain, type Level } from "../constants";
import type { Project } from "../validators";

const lower = (s: string) => s.toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Known skills mentioned in the text, in their canonical spelling. */
export function findSkills(text: string, extra: readonly string[] = []): string[] {
  const t = ` ${lower(text)} `;
  const found = new Set<string>();
  const aliases: Record<string, string> = {
    ml: "Machine Learning", "machine learning": "Machine Learning", cv: "Computer Vision", js: "JavaScript",
    ts: "TypeScript", node: "Node.js", nodejs: "Node.js", "node js": "Node.js", nextjs: "Next.js",
    reactjs: "React", "react js": "React", mongo: "MongoDB", k8s: "Kubernetes", "c++": "C++", cpp: "C++",
    rpi: "Raspberry Pi", "raspberry pi": "Raspberry Pi", llm: "LLMs", llms: "LLMs", "deep learning": "PyTorch",
    "data analytics": "Data Analysis", "data science": "Data Analysis", "embedded": "Embedded C", "aws": "AWS",
  };
  for (const s of [...SKILL_SUGGESTIONS, ...extra]) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}+#.])${escapeRe(lower(s))}(?=$|[^\\p{L}\\p{N}+#])`, "u");
    if (re.test(t)) found.add(s);
  }
  for (const [a, canonical] of Object.entries(aliases)) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}+#.])${escapeRe(a)}(?=$|[^\\p{L}\\p{N}+#])`, "u");
    if (re.test(t)) found.add(canonical);
  }
  return [...found];
}

/** Domains the text points at (exact names or everyday aliases). */
export function findDomains(text: string): Domain[] {
  const t = ` ${lower(text)} `;
  return DOMAINS.filter(
    (d) => t.includes(lower(d)) || DOMAIN_ALIASES[d].some((a) => new RegExp(`\\b${escapeRe(a)}\\b`).test(t)),
  );
}

const WEEKS_RE = /\b(\d{1,2})\s*(?:weeks?|wks?)\b/;
const MONTHS_RE = /\b(\d{1,2})\s*months?\b/;

export function findWeeks(text: string): number | null {
  const t = lower(text);
  const w = t.match(WEEKS_RE);
  if (w) return Number(w[1]);
  const m = t.match(MONTHS_RE);
  if (m) return Number(m[1]) * 4;
  return null;
}

const clampWeeks = (w: number) => Math.min(24, Math.max(4, Math.round(w)));

export type ProfilePatch = {
  addSkills?: string[];
  removeSkills?: string[];
  weeks?: number;
  level?: Level;
  interests?: Domain[];
  hardwareOk?: boolean;
  teamSize?: number;
};

/** "I also know Docker now", "I only have 8 weeks", "we are 4 people"… → a profile patch. */
export function extractProfileUpdate(text: string, current: { skills: string[]; interests: string[] }): ProfilePatch | null {
  const t = lower(text);
  const patch: ProfilePatch = {};

  const removing = /\b(remove|delete|drop|forget|don't know|do not know|no longer)\b/.test(t);
  let skills = findSkills(text);
  // "I know Godot now": capture an unknown skill after "know/learned/add"
  if (!skills.length && !removing) {
    const m = text.match(/\b(?:know|learned|learnt|picked up|add)\s+([A-Za-z][\w.+#-]{1,24}(?:\s[A-Z][\w.+#-]{1,20})?)/i);
    const cand = m?.[1]?.replace(/\b(now|too|also|as well|to my skills)\b.*$/i, "").trim();
    if (cand && !/^(how|what|that|this|it|nothing|about)$/i.test(cand)) skills = [cand.charAt(0).toUpperCase() + cand.slice(1)];
  }
  if (skills.length) {
    if (removing) patch.removeSkills = skills.filter((s) => current.skills.includes(s));
    else patch.addSkills = skills.filter((s) => !current.skills.map(lower).includes(lower(s)));
  }

  const weeks = findWeeks(text);
  if (weeks !== null && /\b(have|got|left|remaining|only|set|change|update|weeks?)\b/.test(t)) patch.weeks = clampWeeks(weeks);

  const lvl = t.match(/\b(beginner|intermediate|advanced)\b/);
  if (lvl) patch.level = (lvl[1]!.charAt(0).toUpperCase() + lvl[1]!.slice(1)) as Level;

  if (/\binterested in\b|\binterests?\b/.test(t)) {
    const d = findDomains(text);
    if (d.length) patch.interests = [...new Set([...d, ...(current.interests as Domain[])])].slice(0, 4);
  }

  if (
    /\bcan('t|not| not) (use|work with|buy|afford)\b.*\b(hardware|arduino|sensors?|iot)\b|\bno hardware\b/.test(t) ||
    /\b(i'm|i am|we're|we are) not (fine|ok|okay|comfortable|happy) with hardware\b/.test(t)
  )
    patch.hardwareOk = false;
  else if (
    /\b(can|could) (use|work with|buy|get)\b.*\b(hardware|arduino|sensors?|raspberry|iot)\b|\bhardware is (fine|ok)\b/.test(t) ||
    /\b(i'm|i am|we're|we are) (fine|ok|okay|comfortable|happy) with hardware\b/.test(t)
  )
    patch.hardwareOk = true;

  const team = t.match(/\b(?:team (?:is|has|of)(?: now)?|we are(?: a team of)?)\s+(\d)\b/);
  if (team) patch.teamSize = Math.min(6, Math.max(1, Number(team[1])));
  if (/\b(working )?(alone|solo|by myself)\b/.test(t)) patch.teamSize = 1;

  if (patch.addSkills?.length === 0) delete patch.addSkills;
  if (patch.removeSkills?.length === 0) delete patch.removeSkills;
  return Object.keys(patch).length ? patch : null;
}

export function describePatch(p: ProfilePatch): string {
  const parts: string[] = [];
  if (p.addSkills?.length) parts.push(`added ${joinList(p.addSkills)} to your skills`);
  if (p.removeSkills?.length) parts.push(`removed ${joinList(p.removeSkills)} from your skills`);
  if (p.weeks) parts.push(`set your time to ${p.weeks} weeks`);
  if (p.level) parts.push(`set your level to ${p.level}`);
  if (p.interests) parts.push(`set your interests to ${joinList(p.interests)}`);
  if (p.hardwareOk !== undefined) parts.push(p.hardwareOk ? "allowed hardware projects" : "switched to software-only projects");
  if (p.teamSize) parts.push(`set your team size to ${p.teamSize}`);
  return parts.join(", ");
}

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ── Refinement ("easier", "use Flutter instead", "something in agriculture") ───────────────
export type QueryProfile = { skills: string[]; interests: string[]; level: Level; weeks: number; hardwareOk: boolean };

export function applyRefinement(text: string, base: QueryProfile): { profile: QueryProfile; changes: string[] } {
  const t = lower(text);
  const p: QueryProfile = { ...base, skills: [...base.skills], interests: [...base.interests] };
  const changes: string[] = [];
  const idx = LEVELS.indexOf(p.level);

  if (/\b(easier|simpler|beginner.?friendly|less (complex|difficult)|basic)\b/.test(t) && idx > 0) {
    p.level = LEVELS[idx - 1]!;
    changes.push(`a ${p.level.toLowerCase()} level`);
  } else if (/\b(harder|tougher|more (advanced|challenging|difficult|complex))\b/.test(t) && idx < LEVELS.length - 1) {
    p.level = LEVELS[idx + 1]!;
    changes.push(`a more ${p.level.toLowerCase()} level`);
  } else if (/\b(easier|simpler)\b/.test(t)) {
    changes.push("simpler scope");
  }

  const weeks = findWeeks(text);
  if (weeks) {
    p.weeks = clampWeeks(weeks);
    changes.push(`${p.weeks} weeks`);
  } else if (/\b(shorter|smaller|quicker|faster)\b/.test(t)) {
    p.weeks = clampWeeks(p.weeks * 0.66);
    changes.push(`about ${p.weeks} weeks`);
  }

  if (/\b(no|without|less) hardware\b|\bsoftware only\b|\bpure software\b/.test(t)) {
    p.hardwareOk = false;
    changes.push("software only");
  } else if (/\bwith (hardware|iot|sensors|arduino)\b/.test(t)) {
    p.hardwareOk = true;
    changes.push("hardware allowed");
  }

  const skills = findSkills(text);
  if (skills.length) {
    p.skills = [...skills, ...p.skills.filter((s) => !skills.includes(s))];
    changes.push(`using ${joinList(skills)}`);
  }

  const domains = findDomains(text);
  if (domains.length) {
    p.interests = domains.slice(0, 4);
    changes.push(`in ${joinList(domains)}`);
  }
  return { profile: p, changes };
}

// ── "the second one" → which card ──────────────────────────────────────────────────────────
const ORDINALS: Record<string, number> = {
  first: 0, "1st": 0, one: 0, second: 1, "2nd": 1, two: 1, third: 2, "3rd": 2, three: 2,
  fourth: 3, "4th": 3, four: 3, fifth: 4, "5th": 4, five: 4,
};

export function resolveCardReference(text: string, cards: Project[]): number | null {
  if (!cards.length) return null;
  const t = lower(text);
  const num = t.match(/(?:#|number|no\.?|option|card|project|idea)\s?([1-9])\b/);
  if (num) {
    const i = Number(num[1]) - 1;
    return i < cards.length ? i : null;
  }
  const ord = t.match(/\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/);
  if (ord) {
    const i = ORDINALS[ord[1]!]!;
    return i < cards.length ? i : null;
  }
  if (/\b(last|final) (one|project|idea)\b/.test(t)) return cards.length - 1;

  // Title words: "explain the sepsis one"
  let best = -1;
  let bestScore = 0;
  const words = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  cards.forEach((c, i) => {
    const score = c.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && words.has(w)).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  if (best >= 0) return best;
  if (cards.length === 1 && /\b(it|this|that|this one|that one)\b/.test(t)) return 0;
  return null;
}

/** A short chat title from the first message. */
export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, " ").replace(/[#*_`>]/g, "").trim();
  const words = clean.split(" ").slice(0, 7).join(" ");
  const title = words.length > 48 ? `${words.slice(0, 47)}…` : words;
  return title ? title.charAt(0).toUpperCase() + title.slice(1).replace(/[?.!,:;]+$/, "") : "New chat";
}
