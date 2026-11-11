import { NextResponse } from "next/server";
import { withUser, parseBody } from "@/lib/api";
import { dismissProject } from "@/lib/recommend";
import { dismissBodySchema } from "@/lib/validators";

// "Not for me": hides the card. It is already in the seen list, so it never comes back.
export const POST = withUser(async ({ req, userId }) => {
  const { projectId } = await parseBody(req, dismissBodySchema);
  await dismissProject(userId, projectId);
  return NextResponse.json({ ok: true });
});
