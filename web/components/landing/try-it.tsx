"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { DomainIcon } from "@/components/domain-icon";
import { DOMAINS, type Domain } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SAMPLES } from "./samples";

/** Pick a domain, see the kind of idea ProjectLens writes. Examples only; clearly labelled. */
export function TryIt() {
  const [domain, setDomain] = useState<Domain>("Healthcare");
  const s = SAMPLES[domain];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div>
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-ink">Try it</p>
        <h2 className="mt-3 text-[2rem] font-semibold leading-tight sm:text-[2.4rem]">Pick a domain you care about</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          This is the shape of what you get: a problem with real users, the skills you already have, one new skill
          to stretch, and milestones that fit your weeks.
        </p>
        <div role="radiogroup" aria-label="Domain" className="mt-6 flex flex-wrap gap-2">
          {DOMAINS.map((d) => {
            const on = d === domain;
            return (
              <button
                key={d}
                role="radio"
                aria-checked={on}
                onClick={() => setDomain(d)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] transition-all duration-150",
                  on
                    ? "border-accent bg-accent-ink text-accent-fg shadow-[0_6px_18px_-8px_var(--accent)]"
                    : "border-border bg-surface text-text/85 hover:border-border-strong hover:bg-sunken",
                )}
              >
                <DomainIcon domain={d} className="size-3.5" />
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <article
        key={domain}
        aria-live="polite"
        className="relative animate-slide-up rounded-[18px] border border-border bg-surface p-6 shadow-[var(--shadow-float)] sm:p-7"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent-ink">
            <Sparkles className="size-3" aria-hidden="true" /> Example idea
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-0.5 text-[12px] text-muted">
            <DomainIcon domain={domain} className="size-3" /> {domain}
          </span>
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[12px] text-muted">{s.weeks} weeks</span>
        </div>
        <h3 className="mt-4 text-[1.45rem] font-semibold leading-snug">{s.title}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-text/80">{s.statement}</p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="mr-0.5 text-muted">Skills you have</span>
          {s.skills.map((k) => (
            <span key={k} className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-ink">
              {k}
            </span>
          ))}
          {s.newSkill && (
            <span className="rounded-full border border-dashed border-border-strong px-2.5 py-0.5">
              <span className="text-muted">New skill:</span> {s.newSkill}
            </span>
          )}
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-3">
          {s.milestones.map(([w, t]) => (
            <li key={w} className="rounded-[12px] border border-border bg-page/60 p-3">
              <p className="text-[11.5px] font-medium uppercase tracking-wide text-accent-ink">Week {w}</p>
              <p className="mt-1 text-[13.5px] leading-snug">{t}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] text-muted">
          <span className="font-medium text-text/80">Tech stack:</span> {s.stack.join(" · ")}
        </p>
        <p className="mt-5 border-t border-border pt-4 text-[12.5px] text-muted">
          Example for illustration. Sign up and ProjectLens writes ideas for <em>your</em> skills, interests and weeks.
        </p>
      </article>
    </div>
  );
}
