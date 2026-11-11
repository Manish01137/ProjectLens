"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/utils";
import { aboutStepSchema, constraintsStepSchema, interestsStepSchema, skillsStepSchema } from "@/lib/validators";
import { AboutFields, ConstraintsFields, InterestsField, SkillsField, type ProfileDraft } from "./fields";

const STEPS = [
  { title: "About you", subtitle: "Which branch and semester are you in?" },
  { title: "Your skills", subtitle: "Pick what you can already use, and how comfortable you are with each." },
  { title: "What you care about", subtitle: "Choose 1 to 4 domains you'd enjoy working on." },
  { title: "Your constraints", subtitle: "So every idea fits the time and setup you really have." },
];

function validate(step: number, d: ProfileDraft) {
  const schema = [aboutStepSchema, skillsStepSchema, interestsStepSchema, constraintsStepSchema][step]!;
  const data =
    step === 0
      ? { branch: d.branch, semester: d.semester }
      : step === 1
        ? { skills: d.skills, skillLevels: d.skillLevels }
        : step === 2
          ? { interests: d.interests }
          : { level: d.level, weeks: d.weeks, teamSize: d.teamSize, hardwareOk: d.hardwareOk, goal: d.goal, guidePreferences: d.guidePreferences };
  const r = schema.safeParse(data);
  return r.success ? { ok: true as const, data: r.data } : { ok: false as const, error: r.error.issues[0]?.message ?? "Check this step" };
}

export function OnboardingWizard({ initial, initialStep, firstName }: { initial: ProfileDraft; initialStep: number; firstName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, 3));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setError(null);
  };

  useEffect(() => headingRef.current?.focus(), [step]);

  async function next() {
    const v = validate(step, draft);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSaving(true);
    try {
      const last = step === STEPS.length - 1;
      await fetchJson("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ step: step + 1, data: v.data, ...(last ? { complete: true } : {}) }),
      });
      if (last) {
        toast.success("Profile saved. Finding your first matches…");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setStep(step + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Keyboard: Enter continues (outside text areas), Alt+← goes back.
  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === "Enter" && !e.shiftKey && tag !== "TEXTAREA" && tag !== "BUTTON") {
      e.preventDefault();
      void next();
    } else if (e.key === "ArrowLeft" && e.altKey && step > 0) {
      e.preventDefault();
      setStep(step - 1);
    }
  }

  const s = STEPS[step]!;
  return (
    <div className="flex min-h-dvh flex-col" onKeyDown={onKeyDown}>
      <div
        className="fixed inset-x-0 top-0 h-[3px] bg-sunken"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuenow={step + 1}
      >
        <div className="h-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <header className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <span className="text-[13px] tabular-nums text-muted">Step {step + 1} of 4</span>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-6 sm:px-6 sm:pt-10">
        {step === 0 && <p className="mb-2 text-muted">Welcome, {firstName}.</p>}
        <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] font-semibold leading-tight outline-none">
          {s.title}
        </h1>
        <p className="mt-2 text-muted">{s.subtitle}</p>
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="mt-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {step === 0 && <AboutFields draft={draft} set={set} />}
              {step === 1 && <SkillsField draft={draft} set={set} />}
              {step === 2 && <InterestsField draft={draft} set={set} />}
              {step === 3 && <ConstraintsFields draft={draft} set={set} />}
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
      </main>
      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || saving} aria-label="Previous step">
            <ArrowLeft /> Back
          </Button>
          <p role="alert" className="min-w-0 flex-1 truncate text-center text-[14px] text-danger">
            {error}
          </p>
          <Button onClick={() => void next()} disabled={saving} size="lg">
            {saving && <Loader2 className="animate-spin" />}
            {step === STEPS.length - 1 ? "Show my matches" : "Continue"}
            {!saving && <ArrowRight />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
