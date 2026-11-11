import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = withUser(async ({ userId }) => {
  const chats = await db.chat.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, pinned: true, updatedAt: true },
    take: 200,
  });
  return NextResponse.json({ chats });
});
