import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, profile: { select: { completedAt: true } } },
  });
  if (!user) redirect("/api/session/clear");
  // Onboarding is required until the profile is complete.
  if (!user.profile?.completedAt) redirect("/onboarding");
  const collapsed = (await cookies()).get("pl_sidebar")?.value === "collapsed";
  return (
    <AppShell user={{ name: user.name, email: user.email, image: user.image }} initialCollapsed={collapsed}>
      {children}
    </AppShell>
  );
}
