import { NextResponse } from "next/server";
import { withUser, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { ensureProfile, getProfile } from "@/lib/profile";
import { profileUpdateSchema } from "@/lib/validators";

export const GET = withUser(async ({ userId }) => {
  await ensureProfile(userId);
  return NextResponse.json({ profile: await getProfile(userId) });
});

export const PUT = withUser(async ({ req, userId }) => {
  const body = await parseBody(req, profileUpdateSchema);
  const current = await ensureProfile(userId);
  const step = body.step === "all" ? 4 : body.step;
  const complete = body.step === "all" || (body.step === 4 && body.complete === true);
  await db.profile.update({
    where: { userId },
    data: {
      ...body.data,
      onboardingStep: Math.max(current.onboardingStep, step),
      ...(complete && !current.completedAt ? { completedAt: new Date() } : {}),
    },
  });
  return NextResponse.json({ profile: await getProfile(userId) });
});
