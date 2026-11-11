import { NextResponse } from "next/server";
import { withUser, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { feedbackSchema } from "@/lib/validators";

export const POST = withUser<{ id: string }>(async ({ req, userId, params }) => {
  const { value } = await parseBody(req, feedbackSchema);
  const msg = await db.message.findFirst({ where: { id: params.id, role: "assistant", chat: { userId } }, select: { id: true } });
  if (!msg) throw new HttpError(404, "Message not found", "not_found");
  await db.message.update({ where: { id: msg.id }, data: { feedback: value === 0 ? null : value } });
  return NextResponse.json({ ok: true });
});
