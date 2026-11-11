"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/utils";
import { fullProfileSchema } from "@/lib/validators";
import { AboutFields, ConstraintsFields, InterestsField, SkillsField, type ProfileDraft } from "./fields";

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8 first:border-t-0 first:pt-2">
      <h2 className="text-[1.3rem] font-semibold">{title}</h2>
      <p className="mb-6 mt-1 text-[14px] text-muted">{hint}</p>
      {children}
    </section>
  );
}

export function ProfileForm({ initial, seenCount }: { initial: ProfileDraft; seenCount: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seen, setSeen] = useState(seenCount);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    const parsed = fullProfileSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your profile");
      return;
    }
    setSaving(true);
    try {
      await fetchJson("/api/profile", { method: "PUT", body: JSON.stringify({ step: "all", data: parsed.data }) });
      toast.success("Profile saved", { description: "New matches will use these details." });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function resetSeen() {
    setConfirmReset(false);
    try {
      const r = await fetchJson<{ cleared: number }>("/api/recommend/reset", { method: "POST" });
      setSeen(0);
      toast.success("Seen projects cleared", { description: `${r.cleared} projects can show up again.` });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Section title="About you" hint="Your branch and semester.">
        <AboutFields draft={draft} set={set} />
      </Section>
      <Section title="Skills" hint="What you can already use, and how comfortable you are.">
        <SkillsField draft={draft} set={set} />
      </Section>
      <Section title="Interests" hint="1 to 4 domains. The model uses these names directly.">
        <InterestsField draft={draft} set={set} />
      </Section>
      <Section title="Constraints" hint="Time, team and setup.">
        <ConstraintsFields draft={draft} set={set} />
      </Section>
      <Section title="Seen projects" hint="Every project you've been shown is remembered so it never repeats.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-surface px-4 py-3.5">
          <p className="text-[15px]">
            <span className="font-semibold tabular-nums">{seen}</span> <span className="text-muted">projects seen so far</span>
          </p>
          <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={seen === 0}>
            <RotateCcw /> Reset seen projects
          </Button>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-page/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {dirty && <span className="text-[13px] text-muted">Unsaved changes</span>}
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(initial)}>
          Discard
        </Button>
        <Button onClick={() => void save()} disabled={!dirty || saving}>
          {saving && <Loader2 className="animate-spin" />} Save profile
        </Button>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Reset seen projects?</DialogTitle>
          <DialogDescription className="mt-2">
            Projects you&apos;ve already been shown may appear again in your matches and chats. Saved projects are not affected.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button onClick={() => void resetSeen()}>Reset</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
