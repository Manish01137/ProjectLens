"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApp } from "@/components/shell/app-context";
import { fetchJson } from "@/lib/utils";
import type { Project } from "@/lib/validators";

export function useProjectActions() {
  const { savedIds, markSaved } = useApp();
  const router = useRouter();

  const save = useCallback(
    async (project: Project) => {
      if (savedIds.has(project.id)) {
        toast("Already in Saved", { action: { label: "Open", onClick: () => router.push("/saved") } });
        return;
      }
      markSaved(project.id, true);
      try {
        await fetchJson("/api/saved", { method: "POST", body: JSON.stringify({ project }) });
        toast.success("Saved to your shortlist", {
          description: project.title,
          action: { label: "View", onClick: () => router.push("/saved") },
        });
      } catch (e) {
        markSaved(project.id, false);
        toast.error((e as Error).message);
      }
    },
    [savedIds, markSaved, router],
  );

  const dismiss = useCallback(async (project: Project) => {
    try {
      await fetchJson("/api/recommend/dismiss", { method: "POST", body: JSON.stringify({ projectId: project.id }) });
      toast("Got it. We won't show that one again.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  return { save, dismiss, isSaved: (id: string) => savedIds.has(id) };
}
