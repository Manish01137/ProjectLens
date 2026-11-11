import type { Metadata } from "next";
import { auth } from "@/auth";
import { ProfileForm } from "@/components/onboarding/profile-form";
import type { ProfileDraft } from "@/components/onboarding/fields";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user.id;
  const p = (await getProfile(userId))!;
  const seen = await db.shownProject.count({ where: { userId } });
  const initial: ProfileDraft = {
    branch: p.branch ?? "CSE",
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
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8 sm:pt-12">
      <h1 className="text-[2.1rem] font-semibold leading-tight">Your profile</h1>
      <p className="mb-6 mt-2 text-muted">Everything the model uses to find projects for you.</p>
      <ProfileForm initial={initial} seenCount={seen} />
    </div>
  );
}
