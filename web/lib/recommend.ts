import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./api";
import * as ml from "./ml";
import { getProfile, toMlProfile } from "./profile";
import type { QueryProfile } from "./chat/understand";
import { applyFilters, postFilter } from "./filters";
import { projectSchema, type AppliedFilters, type Filters, type Project } from "./validators";

export const BATCH_SIZE = 5;

export async function seenCoreIds(userId: string): Promise<string[]> {
  const rows = await db.shownProject.findMany({ where: { userId }, select: { coreProblemId: true }, distinct: ["coreProblemId"] });
  return rows.map((r) => r.coreProblemId);
}

/**
 * Asks the model for projects the student has never seen, then records them in the seen list.
 * Filters ask for extra candidates so that 5 survive the exact post-filter.
 */
export async function recommendForUser(
  userId: string,
  opts: { message?: string; filters?: Filters; source: "dashboard" | "chat"; query?: QueryProfile },
): Promise<{ projects: Project[]; exhausted: boolean; batchId: string | null; applied: AppliedFilters | null }> {
  const profile = await getProfile(userId);
  if (!profile || profile.skills.length === 0) throw new HttpError(409, "Finish your profile first", "profile_incomplete");
  const base: QueryProfile = opts.query ?? {
    skills: profile.skills,
    interests: profile.interests,
    level: profile.level,
    weeks: profile.weeks,
    hardwareOk: profile.hardwareOk,
  };
  const { query, message } = applyFilters(base, opts.message ?? "", opts.filters);
  const hasFilters = Boolean(opts.filters && Object.values(opts.filters).some(Boolean));
  const exclude = await seenCoreIds(userId);

  const res = await ml.recommend({
    profile: toMlProfile(query),
    message,
    k: hasFilters ? 10 : BATCH_SIZE,
    exclude_core_ids: exclude,
    // The ranking enforces an explicit domain itself (and reports it in X-Applied-Filters).
    ...(opts.filters?.domain ? { domains: [opts.filters.domain] } : {}),
  });
  const projects = postFilter(res.projects, opts.filters).slice(0, BATCH_SIZE);
  if (!projects.length) return { projects: [], exhausted: true, batchId: null, applied: res.applied };

  const batchId = randomUUID();
  await db.shownProject.createMany({
    data: projects.map((p, position) => ({
      userId,
      coreProblemId: p.core_problem_id,
      projectId: p.id,
      payload: p,
      source: opts.source,
      batchId,
      position,
    })),
  });
  return { projects, exhausted: false, batchId, applied: res.applied };
}

/** The most recent dashboard batch, without the ones marked "Not for me". */
export async function latestDashboardBatch(userId: string): Promise<Project[] | null> {
  const last = await db.shownProject.findFirst({
    where: { userId, source: "dashboard" },
    orderBy: { shownAt: "desc" },
    select: { batchId: true },
  });
  if (!last) return null;
  const rows = await db.shownProject.findMany({
    where: { userId, batchId: last.batchId, dismissedAt: null },
    orderBy: { position: "asc" },
  });
  return rows.map((r) => projectSchema.safeParse(r.payload)).flatMap((r) => (r.success ? [r.data] : []));
}

export async function dismissProject(userId: string, projectId: string) {
  await db.shownProject.updateMany({ where: { userId, projectId }, data: { dismissedAt: new Date() } });
}

export async function resetSeen(userId: string) {
  const { count } = await db.shownProject.deleteMany({ where: { userId } });
  return count;
}
