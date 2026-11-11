import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Matches } from "@/components/projects/matches";
import { getProfile } from "@/lib/profile";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const profile = (await getProfile(session!.user.id))!;
  const facts = [
    profile.branch && `${profile.branch}${profile.semester ? `, sem ${profile.semester}` : ""}`,
    profile.level,
    `${profile.weeks} weeks`,
    profile.teamSize === 1 ? "Solo" : `Team of ${profile.teamSize}`,
    profile.hardwareOk ? "Hardware OK" : "Software only",
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-[2.1rem] font-semibold leading-tight">Projects for {firstName(session?.user?.name)}</h1>
      <div className="mt-5 flex flex-col gap-3 rounded-[12px] border border-border bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1 text-[14px]">
          <p className="truncate">
            <span className="text-muted">Skills </span>
            {profile.skills.slice(0, 8).join(", ")}
            {profile.skills.length > 8 ? ` +${profile.skills.length - 8}` : ""}
          </p>
          <p className="truncate">
            <span className="text-muted">Interests </span>
            {profile.interests.join(", ")}
            <span className="text-muted"> · {facts.join(" · ")}</span>
          </p>
        </div>
        <Link href="/profile" className="shrink-0 text-[14px] font-medium text-accent-ink underline-offset-4 hover:underline">
          Edit profile
        </Link>
      </div>
      <Matches />
    </div>
  );
}
