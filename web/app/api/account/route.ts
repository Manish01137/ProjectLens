import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { db } from "@/lib/db";

// Deletes the user and, through cascades, their profile, chats, seen list and saved projects.
export const DELETE = withUser(async ({ userId }) => {
  await db.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
});
