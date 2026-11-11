import type { QueryProfile } from "./chat/understand";
import type { Filters, Project } from "./validators";

// Dashboard filters: steer the model query, then keep only exact matches.
export function applyFilters(base: QueryProfile, message: string, filters?: Filters) {
  const q: QueryProfile = { ...base };
  let msg = message;
  if (filters?.domain) {
    q.interests = [filters.domain];
    msg = `${msg} ${filters.domain} project`.trim();
  }
  if (filters?.softwareOnly) q.hardwareOk = false;
  if (filters?.maxWeeks) q.weeks = filters.maxWeeks;
  return { query: q, message: msg };
}

export function postFilter(projects: Project[], filters?: Filters): Project[] {
  if (!filters) return projects;
  return projects.filter(
    (p) =>
      (!filters.domain || p.domain === filters.domain) &&
      (!filters.softwareOnly || p.project_type !== "Hardware") &&
      (!filters.maxWeeks || p.duration_weeks === null || p.duration_weeks <= filters.maxWeeks),
  );
}
