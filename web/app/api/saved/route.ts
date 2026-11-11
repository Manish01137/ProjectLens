import { NextResponse } from "next/server";
import { withUser, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { savedCreateSchema } from "@/lib/validators";

export const GET = withUser(async ({ userId }) => {
  const saved = await db.savedProject.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ saved });
});

export const POST = withUser(async ({ req, userId }) => {
  const { project, note } = await parseBody(req, savedCreateSchema);
  const saved = await db.savedProject.upsert({
    where: { userId_projectId: { userId, projectId: project.id } },
    update: {},
    // The full card as shown, plus how novel a generated idea is compared with the catalogue.
    create: { userId, projectId: project.id, payload: project, noveltySimilarity: project.novelty_similarity ?? null, note: note ?? "" },
  });
  return NextResponse.json({ saved }, { status: 201 });
});
