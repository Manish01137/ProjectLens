import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import type { ProfileDraft } from "@/components/onboarding/fields";
import { db } from "@/lib/db";
import { ensureProfile, toStudentProfile } from "@/lib/profile";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true } });
  if (!user) redirect("/api/session/clear");
  const p = toStudentProfile(await ensureProfile(user.id));
  if (p.completed) redirect("/dashboard");

  const initial: ProfileDraft = {
    branch: p.branch ?? "",
    semester: p.semester ?? 7,
    skills: p.skills,
    skillLevels: p.skillLevels,
    interests: p.interests,
    level: p.level,
    weeks: p.weeks,
    teamSize: p.teamSize,
    hardwareOk: p.hardwareOk,
    goal: (["Placement", "Research", "Startup", "Hackathon"].includes(p.goal) ? p.goal : "Placement") as ProfileDraft["goal"],
    guidePreferences: p.guidePreferences,
  };
  return <OnboardingWizard initial={initial} initialStep={p.onboardingStep} firstName={firstName(user.name)} />;
}
