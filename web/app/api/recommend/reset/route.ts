import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { resetSeen } from "@/lib/recommend";

export const POST = withUser(async ({ userId }) => {
  const cleared = await resetSeen(userId);
  return NextResponse.json({ ok: true, cleared });
});
