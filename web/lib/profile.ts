import "server-only";
import type { Profile as DbProfile } from "@prisma/client";
import { db } from "./db";
import type { Level } from "./constants";

export type StudentProfile = {
  branch: string | null;
  semester: number | null;
  skills: string[];
  skillLevels: Record<string, number>;
  interests: string[];
  level: Level;
  weeks: number;
  teamSize: number;
  hardwareOk: boolean;
  goal: string;
  guidePreferences: string;
  onboardingStep: number;
  completed: boolean;
};

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function toStudentProfile(p: DbProfile): StudentProfile {
  const levels = p.skillLevels && typeof p.skillLevels === "object" && !Array.isArray(p.skillLevels) ? p.skillLevels : {};
  return {
    branch: p.branch,
    semester: p.semester,
    skills: asStrings(p.skills),
    skillLevels: Object.fromEntries(Object.entries(levels).filter(([, v]) => typeof v === "number")) as Record<string, number>,
    interests: asStrings(p.interests),
    level: (["Beginner", "Intermediate", "Advanced"].includes(p.level) ? p.level : "Intermediate") as Level,
    weeks: p.weeks,
    teamSize: p.teamSize,
    hardwareOk: p.hardwareOk,
    goal: p.goal,
    guidePreferences: p.guidePreferences ?? "",
    onboardingStep: p.onboardingStep,
    completed: p.completedAt !== null,
  };
}

export async function getProfile(userId: string): Promise<StudentProfile | null> {
  const p = await db.profile.findUnique({ where: { userId } });
  return p ? toStudentProfile(p) : null;
}

export async function ensureProfile(userId: string) {
  return db.profile.upsert({
    where: { userId },
    update: {},
    create: { userId, skills: [], skillLevels: {}, interests: [] },
  });
}

/** The profile shape the ML service expects. */
export function toMlProfile(p: Pick<StudentProfile, "skills" | "interests" | "level" | "weeks" | "hardwareOk">) {
  return { skills: p.skills, interests: p.interests, level: p.level, weeks: p.weeks, hardware_ok: p.hardwareOk };
}
