import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { jsonError, parseBody, toErrorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`register:${ip}`, 10, 60_000).ok) return jsonError(429, "Too many sign-up attempts. Try again in a minute.");
  try {
    const { name, email, password } = await parseBody(req, signupSchema);
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return jsonError(409, "An account with this email already exists. Try signing in.", "email_taken");
    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.create({
      data: { name, email, passwordHash, profile: { create: { skills: [], skillLevels: {}, interests: [] } } },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
