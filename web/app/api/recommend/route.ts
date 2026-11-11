import { NextResponse } from "next/server";
import { withUser, parseBody } from "@/lib/api";
import { latestDashboardBatch, recommendForUser } from "@/lib/recommend";
import { recommendBodySchema } from "@/lib/validators";

// POST { message?, filters?, fresh? } → { projects, exhausted }
export const POST = withUser(async ({ req, userId }) => {
  const body = await parseBody(req, recommendBodySchema);
  const hasFilters = Boolean(body.filters && Object.values(body.filters).some(Boolean));
  if (!body.fresh && !body.message && !hasFilters) {
    const last = await latestDashboardBatch(userId);
    if (last?.length) return NextResponse.json({ projects: last, exhausted: false });
  }
  const res = await recommendForUser(userId, { message: body.message, filters: body.filters, source: "dashboard" });
  return NextResponse.json({ projects: res.projects, exhausted: res.exhausted, applied: res.applied });
});
