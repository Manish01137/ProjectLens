import { NextResponse } from "next/server";
import { withUser, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { chatPatchSchema } from "@/lib/validators";

type P = { id: string };

async function own(userId: string, id: string) {
  const chat = await db.chat.findFirst({ where: { id, userId } });
  if (!chat) throw new HttpError(404, "Chat not found", "not_found");
  return chat;
}

export const GET = withUser<P>(async ({ userId, params }) => {
  const chat = await own(userId, params.id);
  const messages = await db.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ chat, messages });
});

export const PATCH = withUser<P>(async ({ req, userId, params }) => {
  const body = await parseBody(req, chatPatchSchema);
  await own(userId, params.id);
  const chat = await db.chat.update({ where: { id: params.id }, data: body });
  return NextResponse.json({ chat });
});

export const DELETE = withUser<P>(async ({ userId, params }) => {
  await own(userId, params.id);
  await db.chat.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});
