"use client";
import { useState } from "react";
import { Bookmark, BookmarkCheck, ChevronRight, Lightbulb, Loader2, Sparkles, ThumbsDown, Type } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn, fetchJson } from "@/lib/utils";
import type { Project } from "@/lib/validators";

const techOf = (p: Project) => [...new Set(p.tech_stack.split(/[,;]/).map((s) => s.trim()).filter(Boolean))];
const isGenerated = (p: Project) => p.kind === "generated";

export function ProjectBadges({ p }: { p: Project }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {isGenerated(p) ? (
        <Badge tone="accent">
          <Sparkles className="size-3" aria-hidden="true" /> New idea
        </Badge>
      ) : (
        <Badge className="border border-border bg-transparent">From catalogue</Badge>
      )}
      <Badge>{p.domain}</Badge>
      {p.approach ? <Badge>{p.approach}</Badge> : null}
      {p.level ? <Badge>{p.level}</Badge> : null}
      {p.duration_weeks ? <Badge>{p.duration_weeks} weeks</Badge> : null}
      {p.project_type && p.project_type !== "Software" ? <Badge>{p.project_type}</Badge> : null}
    </div>
  );
}

export function MatchedSkills({ p, className }: { p: Project; className?: string }) {
  if (!p.matched_skills.length) return null;
  return (
    <p className={cn("text-[13px] text-muted", className)}>
      Uses your skills:{" "}
      {p.matched_skills.map((s, i) => (
        <span key={s}>
          <span className="font-medium text-accent-ink">{s}</span>
          {i < p.matched_skills.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

/** "Skills you have" chips plus the one new skill a generated idea asks for. */
export function SkillChips({ p }: { p: Project }) {
  const have = p.skills_used ?? p.matched_skills;
  // The writer sometimes returns "None" or a skill the student already has; neither is a new skill.
  const raw = p.new_skill_to_learn?.trim() ?? "";
  const fresh =
    raw && !/^(none|n\/?a|nil|null|-|no new skill)$/i.test(raw) && !have.some((h) => h.toLowerCase() === raw.toLowerCase()) ? raw : "";
  if (!have.length && !fresh) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
      {have.length > 0 && <span className="mr-0.5 text-muted">Skills you have</span>}
      {have.map((s) => (
        <span key={s} className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-ink">
          {s}
        </span>
      ))}
      {fresh && (
        <span className="rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-text">
          <span className="text-muted">New skill:</span> {fresh}
        </span>
      )}
    </div>
  );
}

export function Milestones({ p, className }: { p: Project; className?: string }) {
  if (!p.milestones?.length) return null;
  return (
    <details className={cn("group/ms relative z-10 rounded-[10px] border border-border", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-text [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted transition-transform group-open/ms:rotate-90" aria-hidden="true" />
        Week-by-week milestones ({p.milestones.length})
      </summary>
      <ol className="space-y-1 border-t border-border px-3 py-2.5 text-[13.5px]">
        {[...p.milestones]
          .sort((a, b) => a.week - b.week)
          .map((m, i) => (
            <li key={`${m.week}-${i}`} className="flex gap-3">
              <span className="w-14 shrink-0 tabular-nums text-muted">Week {m.week}</span>
              <span>{m.task}</span>
            </li>
          ))}
      </ol>
    </details>
  );
}

// "Rewrite in plain words": one LLM call per card, cached for the session.
const plainCache = new Map<string, string>();

function usePlainWords(p: Project) {
  const [text, setText] = useState<string | null>(() => plainCache.get(p.id) ?? null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  async function toggle() {
    if (text) {
      setShown((s) => !s);
      return;
    }
    setLoading(true);
    try {
      const r = await fetchJson<{ text: string }>("/api/rewrite", { method: "POST", body: JSON.stringify({ project: p }) });
      plainCache.set(p.id, r.text);
      setText(r.text);
      setShown(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return { text, loading, shown: shown && Boolean(text), toggle };
}

export function ProjectCard({
  project: p,
  index,
  saved,
  onOpen,
  onSave,
  onExplain,
  onDismiss,
  className,
}: {
  project: Project;
  index?: number;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onExplain: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const plain = usePlainWords(p);
  const generated = isGenerated(p);
  const tech = techOf(p);
  const action =
    "relative z-10 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-sunken hover:text-text [&_svg]:size-4";
  return (
    <article
      data-testid="project-card"
      data-kind={p.kind ?? "catalogue"}
      className={cn(
        "group relative flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <ProjectBadges p={p} />
        {index !== undefined && (
          <span className="shrink-0 font-sans text-[12px] tabular-nums text-muted" aria-label={`Project ${index + 1}`}>
            #{index + 1}
          </span>
        )}
      </div>
      <h3 className="text-[1.15rem] font-semibold leading-snug">
        <button
          onClick={onOpen}
          className="text-left after:absolute after:inset-0 after:rounded-[12px] after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-accent"
        >
          {p.title}
        </button>
      </h3>
      <p className={cn("text-[14.5px] leading-relaxed text-text/80", !generated && "line-clamp-3")}>{p.problem_statement}</p>
      {plain.shown && (
        <p className="relative z-10 rounded-[10px] bg-sunken px-3.5 py-2.5 text-[14.5px] leading-relaxed" data-testid="plain-words">
          <span className="mb-0.5 block font-sans text-[12px] font-medium text-muted">In plain words</span>
          {plain.text}
        </p>
      )}
      {generated ? <SkillChips p={p} /> : <MatchedSkills p={p} />}
      {tech.length > 0 && (
        <p className="text-[13px] text-muted">
          <span className="font-medium text-text/80">Tech stack:</span> {tech.join(" · ")}
        </p>
      )}
      <Milestones p={p} />
      {(p.data_source || (generated && p.why_it_fits)) && (
        <dl className="space-y-1 text-[13px]">
          {p.data_source && (
            <div>
              <dt className="inline font-medium text-text/80">Data source: </dt>
              <dd className="inline text-muted">{p.data_source}</dd>
            </div>
          )}
          {generated && p.why_it_fits && (
            <div>
              <dt className="inline font-medium text-text/80">Why it fits: </dt>
              <dd className="inline text-muted">{p.why_it_fits}</dd>
            </div>
          )}
        </dl>
      )}
      <div className="-mx-1.5 mt-auto flex flex-wrap items-center gap-1 pt-1">
        <button onClick={onSave} className={cn(action, saved && "text-accent-ink")} aria-pressed={saved}>
          {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Saved" : "Save"}
        </button>
        <button onClick={() => void plain.toggle()} className={action} aria-expanded={plain.shown} disabled={plain.loading}>
          {plain.loading ? <Loader2 className="animate-spin" /> : <Type />} {plain.shown ? "Hide plain words" : "Rewrite in plain words"}
        </button>
        <button onClick={onExplain} className={action}>
          <Lightbulb /> Explain this
        </button>
        {onDismiss && (
          <button onClick={onDismiss} className={action}>
            <ThumbsDown /> Not for me
          </button>
        )}
      </div>
    </article>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-5" aria-hidden="true">
      <div className="flex gap-1.5">
        <div className="h-6 w-20 animate-pulse rounded-full bg-sunken" />
        <div className="h-6 w-28 animate-pulse rounded-full bg-sunken" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-sunken" />
      </div>
      <div className="h-6 w-4/5 animate-pulse rounded bg-sunken" />
      <div className="space-y-2">
        <div className="h-4 animate-pulse rounded bg-sunken" />
        <div className="h-4 animate-pulse rounded bg-sunken" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-sunken" />
      </div>
      <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
    </div>
  );
}
