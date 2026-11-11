import "server-only";
import { db } from "../db";
import { randomUUID } from "node:crypto";
import { coreIdsOf } from "../cards";
import { completeJson, streamText } from "../llm";
import * as ml from "../ml";
import { getProfile } from "../profile";
import { projectListSchema } from "../validators";
import { EXTRACT_SCHEMA, EXTRACT_SYSTEM, validateExtraction } from "./profile-extract";
import type { ChatProfile, RouterDeps } from "./router";
import type { ProfilePatch } from "./understand";

export async function loadChatProfile(userId: string, name: string | null | undefined): Promise<ChatProfile | null> {
  const p = await getProfile(userId);
  if (!p) return null;
  return {
    name: name ?? "there",
    branch: p.branch,
    semester: p.semester,
    skills: p.skills,
    interests: p.interests,
    level: p.level,
    weeks: p.weeks,
    hardwareOk: p.hardwareOk,
    goal: p.goal,
  };
}

export async function applyProfilePatch(userId: string, patch: ProfilePatch) {
  const p = await getProfile(userId);
  if (!p) throw new Error("Profile missing");
  let skills = p.skills;
  const skillLevels = { ...p.skillLevels };
  if (patch.addSkills) {
    skills = [...skills, ...patch.addSkills.filter((s) => !skills.includes(s))].slice(0, 25);
    for (const s of patch.addSkills) skillLevels[s] ??= 1;
  }
  if (patch.removeSkills) {
    skills = skills.filter((s) => !patch.removeSkills!.includes(s));
    for (const s of patch.removeSkills) delete skillLevels[s];
    if (!skills.length) skills = p.skills; // the model needs at least one skill
  }
  await db.profile.update({
    where: { userId },
    data: {
      skills,
      skillLevels,
      ...(patch.weeks ? { weeks: patch.weeks } : {}),
      ...(patch.level ? { level: patch.level } : {}),
      ...(patch.interests ? { interests: patch.interests } : {}),
      ...(patch.hardwareOk !== undefined ? { hardwareOk: patch.hardwareOk } : {}),
      ...(patch.teamSize ? { teamSize: patch.teamSize } : {}),
    },
  });
}

/** Every core-problem id this conversation has used: cards shown (inspired_by) and /generate grounding. */
export function conversationCoreIds(messages: { projects: unknown; meta: unknown }[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    const cards = projectListSchema.safeParse(m.projects ?? []);
    if (cards.success) for (const c of cards.data) for (const id of coreIdsOf(c)) ids.add(id);
    const meta = m.meta as { grounding?: unknown } | null;
    if (Array.isArray(meta?.grounding)) for (const g of meta.grounding) if (typeof g === "string") ids.add(g);
  }
  return [...ids];
}

export function createDeps(userId: string, name: string | null | undefined): RouterDeps {
  return {
    remoteIntent: ml.remoteIntent,
    async understand(text, level) {
      const u = await ml.understand(text, level);
      return u ? { domains: u.domains, approaches: u.approaches, levels: u.levels, weeks: u.weeks, hardware_ok: u.hardware_ok } : null;
    },
    generate: (req) => ml.generate(req),
    recommend: (req) => ml.recommend(req),
    async recordShown(cards) {
      const batchId = randomUUID();
      await db.shownProject.createMany({
        data: cards.map((p, position) => ({
          userId,
          coreProblemId: p.core_problem_id,
          projectId: p.id,
          payload: p,
          source: "chat",
          batchId,
          position,
        })),
      });
    },
    async updateProfile(patch) {
      await applyProfilePatch(userId, patch);
      return (await loadChatProfile(userId, name))!;
    },
    async extractProfile(text, profile) {
      try {
        const raw = await completeJson({ system: EXTRACT_SYSTEM, user: text, schema: EXTRACT_SCHEMA });
        return validateExtraction(raw, profile, text);
      } catch {
        return null; // no LLM: the rules take over
      }
    },
    stream: (args) => streamText(args),
    isMlUnavailable: (err) => err instanceof ml.MlUnavailableError || err instanceof ml.MlInvalidProfileError,
    exhaustedApplied: (err) => (err instanceof ml.MlExhaustedError ? err.applied : undefined),
  };
}
