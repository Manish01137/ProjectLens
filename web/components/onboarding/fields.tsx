"use client";
import { useId, useMemo, useState } from "react";
import { Slider, Switch } from "radix-ui";
import { Check, Plus, X } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BRANCHES, DOMAINS, GOALS, LEVELS, SKILL_SUGGESTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ProfileDraft = {
  branch: string;
  semester: number;
  skills: string[];
  skillLevels: Record<string, number>;
  interests: string[];
  level: (typeof LEVELS)[number];
  weeks: number;
  teamSize: number;
  hardwareOk: boolean;
  goal: (typeof GOALS)[number];
  guidePreferences: string;
};

type Setter = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] transition-colors duration-150 focus-visible:outline-2";
const chipOff = "border-border bg-surface text-text hover:border-border-strong hover:bg-sunken/60";
const chipOn = "border-accent bg-accent-soft text-accent-ink";

/** Single-choice pill group with arrow-key navigation (radio semantics). */
export function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render = String,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="space-y-2.5">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const on = value === o;
          return (
            <button
              key={String(o)}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (value === null && i === 0) ? 0 : -1}
              onClick={() => onChange(o)}
              onKeyDown={(e) => {
                const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!dir) return;
                e.preventDefault();
                const next = options[(i + dir + options.length) % options.length]!;
                onChange(next);
                const btns = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
                btns?.[(i + dir + options.length) % options.length]?.focus();
              }}
              className={cn(chip, on ? chipOn : chipOff)}
            >
              {render(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AboutFields({ draft, set }: { draft: ProfileDraft; set: Setter }) {
  return (
    <div className="space-y-8">
      <PillGroup label="Branch" options={BRANCHES} value={(draft.branch || null) as (typeof BRANCHES)[number] | null} onChange={(v) => set("branch", v)} />
      <PillGroup label="Semester" options={[1, 2, 3, 4, 5, 6, 7, 8] as const} value={draft.semester} onChange={(v) => set("semester", v)} />
    </div>
  );
}

const LEVEL_LABEL = ["", "Learning", "Comfortable", "Strong"];

export function SkillsField({ draft, set }: { draft: ProfileDraft; set: Setter }) {
  const [query, setQuery] = useState("");
  const selected = new Set(draft.skills.map((s) => s.toLowerCase()));
  const suggestions = useMemo(
    () => SKILL_SUGGESTIONS.filter((s) => !selected.has(s.toLowerCase()) && s.toLowerCase().includes(query.trim().toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, draft.skills],
  );
  const q = query.trim();
  const canAddCustom = q.length > 0 && q.length <= 40 && !selected.has(q.toLowerCase()) && !SKILL_SUGGESTIONS.some((s) => s.toLowerCase() === q.toLowerCase());

  const add = (s: string) => {
    if (selected.has(s.toLowerCase()) || draft.skills.length >= 25) return;
    set("skills", [...draft.skills, s]);
    set("skillLevels", { ...draft.skillLevels, [s]: draft.skillLevels[s] ?? 2 });
    setQuery("");
  };
  const remove = (s: string) => {
    set("skills", draft.skills.filter((x) => x !== s));
    const { [s]: _drop, ...rest } = draft.skillLevels;
    set("skillLevels", rest);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="skill-search">Search or add a skill</Label>
        <Input
          id="skill-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q) {
              e.preventDefault();
              e.stopPropagation();
              const exact = SKILL_SUGGESTIONS.find((s) => s.toLowerCase() === q.toLowerCase());
              add(exact ?? suggestions[0] ?? q);
            }
          }}
          placeholder="Python, Flutter, GIS…"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Suggestions">
        {suggestions.slice(0, query ? 12 : 33).map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className={cn(chip, chipOff)}>
            <Plus className="size-3.5 text-muted" aria-hidden="true" /> {s}
          </button>
        ))}
        {canAddCustom && (
          <button type="button" onClick={() => add(q)} className={cn(chip, "border-dashed border-border-strong text-text hover:bg-sunken")}>
            <Plus className="size-3.5" aria-hidden="true" /> Add &ldquo;{q}&rdquo;
          </button>
        )}
      </div>

      {draft.skills.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Your skills ({draft.skills.length}) and how comfortable you are</p>
          <ul className="divide-y divide-border rounded-[12px] border border-border bg-surface">
            {draft.skills.map((s) => (
              <li key={s} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{s}</span>
                <div role="radiogroup" aria-label={`${s} level`} className="flex gap-1">
                  {[1, 2, 3].map((n) => {
                    const on = (draft.skillLevels[s] ?? 2) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${LEVEL_LABEL[n]} (${n} of 3)`}
                        onClick={() => set("skillLevels", { ...draft.skillLevels, [s]: n })}
                        className={cn(
                          "h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                          on ? "bg-accent-ink text-accent-fg" : "bg-sunken text-muted hover:text-text",
                        )}
                      >
                        {LEVEL_LABEL[n]}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  aria-label={`Remove ${s}`}
                  className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-text"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function InterestsField({ draft, set }: { draft: ProfileDraft; set: Setter }) {
  const toggle = (d: string) => {
    if (draft.interests.includes(d)) set("interests", draft.interests.filter((x) => x !== d));
    else if (draft.interests.length < 4) set("interests", [...draft.interests, d]);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted" aria-live="polite">
        {draft.interests.length}/4 selected
      </p>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Domains">
        {DOMAINS.map((d) => {
          const on = draft.interests.includes(d);
          const full = !on && draft.interests.length >= 4;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => toggle(d)}
              className={cn(
                "flex min-h-12 items-center justify-between gap-2 rounded-[12px] border px-4 py-2.5 text-left text-[15px] transition-colors duration-150",
                on ? "border-accent bg-accent-soft text-text" : "border-border bg-surface hover:border-border-strong",
                full && "opacity-50",
              )}
            >
              {d}
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  on ? "border-accent-ink bg-accent-ink text-accent-fg" : "border-border-strong",
                )}
                aria-hidden="true"
              >
                {on && <Check className="size-3" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ConstraintsFields({ draft, set }: { draft: ProfileDraft; set: Setter }) {
  return (
    <div className="space-y-8">
      <PillGroup label="Your level" options={LEVELS} value={draft.level} onChange={(v) => set("level", v)} />
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p id="weeks-label" className="text-sm font-medium">
            Weeks available
          </p>
          <span className="font-serif text-xl font-semibold tabular-nums">{draft.weeks} weeks</span>
        </div>
        <Slider.Root
          aria-labelledby="weeks-label"
          min={4}
          max={24}
          step={1}
          value={[draft.weeks]}
          onValueChange={([v]) => v !== undefined && set("weeks", v)}
          className="relative flex h-6 touch-none select-none items-center"
        >
          <Slider.Track className="relative h-1.5 grow rounded-full bg-sunken">
            <Slider.Range className="absolute h-full rounded-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb
            aria-label="Weeks available"
            className="block size-5 rounded-full border-2 border-accent bg-surface shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </Slider.Root>
        <div className="flex justify-between text-[12px] text-muted">
          <span>4</span>
          <span>24</span>
        </div>
      </div>
      <PillGroup label="Team size" options={[1, 2, 3, 4, 5, 6] as const} value={draft.teamSize} onChange={(v) => set("teamSize", v)} render={(v) => (v === 1 ? "Solo" : String(v))} />
      <div className="flex items-center justify-between gap-4 rounded-[12px] border border-border bg-surface px-4 py-3.5">
        <div>
          <p id="hw-label" className="text-[15px] font-medium">
            Hardware is OK
          </p>
          <p className="text-[13px] text-muted">Arduino, sensors, Raspberry Pi and similar</p>
        </div>
        <Switch.Root
          aria-labelledby="hw-label"
          checked={draft.hardwareOk}
          onCheckedChange={(v) => set("hardwareOk", v)}
          className="relative h-6 w-11 shrink-0 rounded-full bg-border-strong transition-colors data-[state=checked]:bg-accent-ink"
        >
          <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-[22px]" />
        </Switch.Root>
      </div>
      <PillGroup label="Main goal" options={GOALS} value={draft.goal} onChange={(v) => set("goal", v)} />
      <div className="space-y-2">
        <Label htmlFor="guide">
          Guide preferences <span className="font-normal text-muted">(optional)</span>
        </Label>
        <Textarea
          id="guide"
          value={draft.guidePreferences}
          onChange={(e) => set("guidePreferences", e.target.value)}
          maxLength={1000}
          placeholder="For example: our guide prefers research-oriented projects with a published dataset."
        />
      </div>
    </div>
  );
}
