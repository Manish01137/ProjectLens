import { NextResponse } from "next/server";
import { withUser, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { savedPatchSchema } from "@/lib/validators";

type P = { id: string };

async function own(userId: string, id: string) {
  const row = await db.savedProject.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new HttpError(404, "Saved project not found", "not_found");
}

export const PATCH = withUser<P>(async ({ req, userId, params }) => {
  const body = await parseBody(req, savedPatchSchema);
  await own(userId, params.id);
  const saved = await db.savedProject.update({ where: { id: params.id }, data: body });
  return NextResponse.json({ saved });
});

export const DELETE = withUser<P>(async ({ userId, params }) => {
  await own(userId, params.id);
  await db.savedProject.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});
