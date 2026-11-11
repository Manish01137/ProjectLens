"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, CloudOff, RefreshCw, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { useApp } from "@/components/shell/app-context";
import { DOMAINS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AppliedFilters, Filters, Project } from "@/lib/validators";
import { FilterLine } from "./filter-line";
import { ProjectCard, ProjectCardSkeleton } from "./project-card";
import { useProjectActions } from "./use-project-actions";

type State =
  | { kind: "loading" }
  | { kind: "ready"; projects: Project[]; applied: AppliedFilters | null }
  | { kind: "exhausted" }
  | { kind: "warming" }
  | { kind: "error"; message: string };

const pill =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors data-[state=open]:bg-sunken [&_svg]:size-3.5";
const pillOff = "border-border bg-surface text-text hover:bg-sunken";
const pillOn = "border-accent bg-accent-soft text-accent-ink";

export function Matches() {
  const { openDetail } = useApp();
  const { save, dismiss, isSaved } = useProjectActions();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [filters, setFilters] = useState<Filters>({});
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  const load = useCallback(async (opts: { fresh: boolean; filters: Filters }) => {
    setBusy(true);
    if (opts.fresh) setState({ kind: "loading" });
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fresh: opts.fresh, filters: opts.filters }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        projects?: Project[];
        exhausted?: boolean;
        applied?: AppliedFilters | null;
        error?: string;
        code?: string;
      };
      if (res.status === 503) setState({ kind: "warming" });
      else if (!res.ok) setState({ kind: "error", message: j.error ?? "Something went wrong" });
      else if (j.exhausted || !j.projects?.length) setState({ kind: "exhausted" });
      else setState({ kind: "ready", projects: j.projects, applied: j.applied ?? null });
    } catch {
      setState({ kind: "warming" });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      void load({ fresh: false, filters: {} });
    }
  }, [load]);

  const applyFilters = (f: Filters) => {
    setFilters(f);
    void load({ fresh: true, filters: f });
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section aria-labelledby="matches-title" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="matches-title" className="text-[1.5rem] font-semibold">
            Your matches
          </h2>
          <p className="mt-1 text-[14px] text-muted">Every batch is new. You won&apos;t see the same problem twice.</p>
        </div>
        <Button onClick={() => void load({ fresh: true, filters })} disabled={busy} size="md">
          <Shuffle className={cn(busy && "animate-spin")} /> Show me different projects
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filters">
        <Menu>
          <MenuTrigger className={cn(pill, filters.domain ? pillOn : pillOff)}>
            {filters.domain ?? "Any domain"} <ChevronDown />
          </MenuTrigger>
          <MenuContent align="start" className="max-h-80 overflow-y-auto">
            <MenuItem onSelect={() => applyFilters({ ...filters, domain: undefined })}>Any domain</MenuItem>
            {DOMAINS.map((d) => (
              <MenuItem key={d} onSelect={() => applyFilters({ ...filters, domain: d })}>
                {filters.domain === d ? <Check /> : <span className="size-4" />} {d}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <button
          aria-pressed={Boolean(filters.softwareOnly)}
          onClick={() => applyFilters({ ...filters, softwareOnly: !filters.softwareOnly || undefined })}
          className={cn(pill, filters.softwareOnly ? pillOn : pillOff)}
        >
          {filters.softwareOnly && <Check />} Software only
        </button>
        <Menu>
          <MenuTrigger className={cn(pill, filters.maxWeeks ? pillOn : pillOff)}>
            {filters.maxWeeks ? `Up to ${filters.maxWeeks} weeks` : "Any length"} <ChevronDown />
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem onSelect={() => applyFilters({ ...filters, maxWeeks: undefined })}>Any length</MenuItem>
            {[6, 8, 12, 16, 20].map((w) => (
              <MenuItem key={w} onSelect={() => applyFilters({ ...filters, maxWeeks: w })}>
                {filters.maxWeeks === w ? <Check /> : <span className="size-4" />} Up to {w} weeks
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        {hasFilters && (
          <button onClick={() => applyFilters({})} className={cn(pill, "border-transparent text-muted hover:text-text")}>
            <X /> Clear
          </button>
        )}
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={state.kind === "loading"}>
        {state.kind === "loading" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}
        {state.kind === "ready" && state.applied && <FilterLine applied={state.applied} cardLevels={state.projects.map((p) => p.level)} />}
        {state.kind === "ready" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                className="animate-slide-up"
                saved={isSaved(p.id)}
                onOpen={() => openDetail(p, "dashboard")}
                onSave={() => void save(p)}
                onExplain={() => openDetail(p, "dashboard")}
                onDismiss={() => {
                  void dismiss(p);
                  setState((s) => (s.kind === "ready" ? { ...s, projects: s.projects.filter((x) => x.id !== p.id) } : s));
                }}
              />
            ))}
          </div>
        )}
        {state.kind === "warming" && (
          <Empty
            icon={<CloudOff />}
            title="Recommendations are warming up, try again in a moment"
            text="The matching model is starting or downloading. Everything else works in the meantime."
            action={
              <Button variant="secondary" onClick={() => void load({ fresh: false, filters })}>
                <RefreshCw /> Try again
              </Button>
            }
          />
        )}
        {state.kind === "exhausted" && (
          <Empty
            icon={<Check />}
            title={hasFilters ? "Nothing new matches these filters" : "You've seen every match for this profile"}
            text={
              hasFilters
                ? "Try loosening a filter. Projects you've already seen are never repeated."
                : "Broaden your interests or add skills on your profile, or reset the projects you've seen."
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => applyFilters({})}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="secondary" asChild>
                  <Link href="/profile">Go to profile</Link>
                </Button>
              )
            }
          />
        )}
        {state.kind === "error" && (
          <Empty
            icon={<CloudOff />}
            title="That didn't work"
            text={state.message}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  toast.dismiss();
                  void load({ fresh: false, filters });
                }}
              >
                <RefreshCw /> Try again
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border border-dashed border-border-strong px-6 py-14 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-muted [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <h3 className="mt-4 text-[1.15rem] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-[14px] text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
