"use client";
import { useState } from "react";
import { Dialog as D } from "radix-ui";
import { Bookmark, BookmarkCheck, Copy, Download, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/chat/markdown";
import { useApp } from "@/components/shell/app-context";
import { projectToText } from "@/lib/plan";
import { fetchJson } from "@/lib/utils";
import type { Project } from "@/lib/validators";
import { MatchedSkills, Milestones, ProjectBadges, SkillChips } from "./project-card";
import { useProjectActions } from "./use-project-actions";

type Plan = { markdown: string; outline: { skillsToLearn: string[] }; generated: boolean };
const planCache = new Map<string, Plan>();

async function downloadPdf(p: Project, plan: Plan | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;
  const write = (text: string, size: number, style: "normal" | "bold" = "normal", gap = 6, font = "helvetica") => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += size * 1.35;
    }
    y += gap;
  };
  write("ProjectLens", 10, "bold", 4);
  write(p.title, 18, "bold", 8, "times");
  write(`${p.domain} · ${p.approach} · ${p.level}${p.duration_weeks ? ` · ${p.duration_weeks} weeks` : ""}`, 10, "normal", 12);
  write("Problem statement", 12, "bold", 2);
  write(p.problem_statement, 11, "normal", 12);
  write("Tech stack", 12, "bold", 2);
  write(p.tech_stack, 11, "normal", 12);
  if (plan) {
    for (const raw of plan.markdown.split("\n")) {
      const line = raw.replace(/\*\*/g, "").replace(/^#+\s*/, "");
      if (!line.trim()) {
        y += 4;
        continue;
      }
      const heading = /^#+\s/.test(raw) || /^\*\*.*\*\*$/.test(raw.trim());
      write(line.replace(/^- /, "•  "), heading ? 12 : 11, heading ? "bold" : "normal", 2);
    }
  }
  write(`Reference ${p.id} · ${p.source}`, 9, "normal", 0);
  doc.save(`${p.title.replace(/[^\w]+/g, "-").slice(0, 60)}.pdf`);
}

export function ProjectDetailPanel() {
  const { detail, closeDetail } = useApp();
  const p = detail?.project ?? null;
  return (
    <D.Root open={p !== null} onOpenChange={(o) => !o && closeDetail()}>
      {p && <DetailBody key={p.id} p={p} />}
    </D.Root>
  );
}

function DetailBody({ p }: { p: Project }) {
  const { save, isSaved } = useProjectActions();
  const [plan, setPlan] = useState<Plan | null>(() => planCache.get(p.id) ?? null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetchJson<Plan>("/api/plan", { method: "POST", body: JSON.stringify({ project: p }) });
      planCache.set(p.id, res);
      setPlan(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(projectToText(p) + (plan ? `\n\n${plan.markdown}` : ""));
    toast.success("Copied as text");
  }

  const saved = isSaved(p.id);

  return (
        <SheetContent side="right" label={`Project details: ${p.title}`} aria-describedby={undefined}>
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
            <span className="text-[13px] font-medium text-muted">Project brief</span>
            <D.Close asChild>
              <Button variant="quiet" size="icon-sm" aria-label="Close panel">
                <X />
              </Button>
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            <ProjectBadges p={p} />
            <D.Title className="mt-4 font-serif text-[1.6rem] font-semibold leading-tight">{p.title}</D.Title>
            <div className="mt-3">{p.kind === "generated" ? <SkillChips p={p} /> : <MatchedSkills p={p} />}</div>
            {p.kind === "generated" && (
              <section className="mt-6 space-y-3">
                <Milestones p={p} />
                <dl className="space-y-1.5 text-[14px]">
                  {p.target_users && (
                    <div>
                      <dt className="inline font-medium">Who it&apos;s for: </dt>
                      <dd className="inline text-muted">{p.target_users}</dd>
                    </div>
                  )}
                  {p.data_source && (
                    <div>
                      <dt className="inline font-medium">Data source: </dt>
                      <dd className="inline text-muted">{p.data_source}</dd>
                    </div>
                  )}
                  {p.why_it_fits && (
                    <div>
                      <dt className="inline font-medium">Why it fits: </dt>
                      <dd className="inline text-muted">{p.why_it_fits}</dd>
                    </div>
                  )}
                  {p.novelty_similarity !== undefined && (
                    <div className="text-[12.5px] text-muted">
                      Novelty check: closest catalogue project at {Math.round(p.novelty_similarity * 100)}% similarity (limit 85%).
                    </div>
                  )}
                </dl>
              </section>
            )}
            <section className="mt-6">
              <h3 className="font-sans text-[13px] font-medium uppercase tracking-wide text-muted">Problem statement</h3>
              <p className="prose-reply mt-2">{p.problem_statement}</p>
            </section>
            <section className="mt-6">
              <h3 className="font-sans text-[13px] font-medium uppercase tracking-wide text-muted">Tech stack</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.tech_stack
                  .split(/[,;]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => (
                    <span
                      key={s}
                      className={
                        p.matched_skills.some((m) => m.toLowerCase() === s.toLowerCase())
                          ? "rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] text-accent-ink"
                          : "rounded-full border border-border px-2.5 py-0.5 text-[13px]"
                      }
                    >
                      {s}
                    </span>
                  ))}
              </div>
            </section>
            <section className="mt-7">
              <h3 className="font-sans text-[13px] font-medium uppercase tracking-wide text-muted">Week-by-week plan</h3>
              {plan ? (
                <div className="mt-3">
                  <Markdown>{plan.markdown}</Markdown>
                </div>
              ) : loading ? (
                <div className="mt-3 space-y-2.5" aria-busy="true" aria-label="Writing your plan">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              ) : (
                <div className="mt-3 rounded-[12px] border border-dashed border-border-strong p-5">
                  <p className="text-[14px] text-muted">
                    A plan sized to your available weeks, with the skills to learn and what to do first.
                  </p>
                  <Button className="mt-3" size="sm" onClick={generate}>
                    <Sparkles /> Generate plan
                  </Button>
                </div>
              )}
            </section>
            <p className="mt-8 text-[12px] text-muted">
              Reference {p.id} · {p.source}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-5 py-3">
            <Button size="sm" onClick={() => void save(p)} variant={saved ? "secondary" : "primary"}>
              {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Saved" : "Save"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              <Copy /> Copy as text
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void downloadPdf(p, plan)}>
              <Download /> Download PDF
            </Button>
            {loading && <Loader2 className="ml-auto size-4 animate-spin self-center text-muted" aria-hidden="true" />}
          </div>
        </SheetContent>
  );
}
