import type { Metadata } from "next";
import { auth } from "@/auth";
import { SavedBoard, type SavedItem } from "@/components/saved/board";
import { db } from "@/lib/db";
import { SAVED_STATUSES, type SavedStatus } from "@/lib/constants";
import { projectSchema } from "@/lib/validators";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const session = await auth();
  const rows = await db.savedProject.findMany({ where: { userId: session!.user.id }, orderBy: { updatedAt: "desc" } });
  const items: SavedItem[] = rows.flatMap((r) => {
    const p = projectSchema.safeParse(r.payload);
    if (!p.success) return [];
    const status = (SAVED_STATUSES as readonly string[]).includes(r.status) ? (r.status as SavedStatus) : "Shortlisted";
    return [{ id: r.id, projectId: r.projectId, status, note: r.note, project: p.data }];
  });
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-[2.1rem] font-semibold leading-tight">Saved projects</h1>
      <p className="mt-2 text-muted">Move ideas along as you narrow down. Notes are just for you.</p>
      <SavedBoard initial={items} />
    </div>
  );
}
