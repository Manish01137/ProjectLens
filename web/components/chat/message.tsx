"use client";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { FILTER_SEPARATOR } from "./composer";
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Tip } from "@/components/ui/tooltip";
import { ProjectCard } from "@/components/projects/project-card";
import { useProjectActions } from "@/components/projects/use-project-actions";
import { useApp } from "@/components/shell/app-context";
import { cn, fetchJson } from "@/lib/utils";
import type { AppliedFilters, Project } from "@/lib/validators";
import { FilterLine } from "@/components/projects/filter-line";
import dynamic from "next/dynamic";

// react-markdown loads with the first message, not with the empty chat screen.
const Markdown = dynamic(() => import("./markdown").then((m) => m.Markdown), {
  loading: () => null,
});

export type CardsMetaView = {
  applied: AppliedFilters | null;
  source: string;
  writerOffline: boolean;
  requested?: { levels: string[] | null; approaches: string[] | null } | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  projects?: Project[] | null;
  meta?: CardsMetaView | null;
  intent?: string | null;
  feedback?: number | null;
  pending?: boolean;
  status?: string | null;
};

export function UserMessage({ m }: { m: ChatMessage }) {
  const [text, filters] = m.content.split(FILTER_SEPARATOR);
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-sunken px-4 py-2.5 text-[15.5px] leading-relaxed">
        <p className="whitespace-pre-wrap break-words">{text}</p>
        {filters && (
          <div className="mt-1.5 flex flex-wrap justify-end gap-1" aria-label="Filters used">
            {filters.split(" · ").map((f) => (
              <span key={f} className="rounded-full bg-surface px-2 py-px text-[11.5px] font-medium text-accent-ink">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ThinkingDots() {
  return (
    <div className="flex h-7 items-center gap-1.5" role="status" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2 rounded-full bg-accent animate-pulse-dot" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </div>
  );
}

/** While the assistant works: shimmering status, seconds elapsed, and a bar for long jobs. */
function Working({ status }: { status?: string | null }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const label = status ?? (secs < 2 ? "Thinking" : "Thinking it through");
  return (
    <div role="status" aria-label={label} className="pt-0.5">
      <div className="flex items-center gap-3">
        {status ? null : <ThinkingDots />}
        <span className="shimmer-text font-sans text-[14px] font-medium">{label}</span>
        {secs >= 3 && <span className="font-sans text-[12px] tabular-nums text-muted">{secs}s</span>}
      </div>
      {status && (
        <div className="mt-2.5 max-w-xs">
          <div className="progress-indeterminate h-1 rounded-full bg-sunken" />
          <p className="mt-2 font-sans text-[12px] text-muted">
            {secs < 20 ? "Checking each idea for your skills, weeks and originality." : "Almost there. New ideas take up to a minute."}
          </p>
        </div>
      )}
    </div>
  );
}

const iconBtn =
  "flex size-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-sunken hover:text-text [&_svg]:size-4";

export function AssistantMessage({
  m,
  isLast,
  streaming,
  onRegenerate,
  onExplain,
}: {
  m: ChatMessage;
  isLast: boolean;
  streaming: boolean;
  onRegenerate: () => void;
  onExplain: (index: number, p: Project) => void;
}) {
  const { openDetail } = useApp();
  const { save, dismiss, isSaved } = useProjectActions();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<number | null>(m.feedback ?? null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const cards = (m.projects ?? []).filter((p) => !hidden.has(p.id));
  const persisted = !m.pending && !m.id.startsWith("tmp-");

  async function rate(v: 1 | -1) {
    const next = feedback === v ? 0 : v;
    setFeedback(next || null);
    try {
      await fetchJson(`/api/messages/${m.id}/feedback`, { method: "POST", body: JSON.stringify({ value: next }) });
      if (next) toast("Thanks for the feedback");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="group/msg relative animate-fade-in sm:pl-11" data-testid="assistant-message" data-intent={m.intent ?? undefined}>
      <span aria-hidden="true" className="absolute left-0 top-0.5 hidden sm:block">
        <LogoMark className={cn("size-7", m.pending && "animate-pulse")} />
      </span>
      {m.pending && !m.content && !cards.length ? (
        <Working status={m.status} />
      ) : (
        <>
          {m.content && <Markdown>{m.content}</Markdown>}
          {cards.length > 0 && (
            <div className="mt-4">
              <FilterLine
                applied={m.meta?.applied}
                requested={m.meta?.requested}
                cardLevels={cards.map((c) => c.level)}
                writerOffline={m.meta?.writerOffline}
              />
            </div>
          )}
          {cards.length > 0 && (
            <div className="grid gap-3">
              {cards.map((p, i) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  index={(m.projects ?? []).indexOf(p) >= 0 ? (m.projects ?? []).indexOf(p) : i}
                  saved={isSaved(p.id)}
                  onOpen={() => openDetail(p, "chat")}
                  onSave={() => void save(p)}
                  onExplain={() => onExplain((m.projects ?? []).indexOf(p), p)}
                  onDismiss={() => {
                    void dismiss(p);
                    setHidden((h) => new Set(h).add(p.id));
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
      {persisted && !(isLast && streaming) && (
        <div
          className={cn(
            "mt-2 flex items-center gap-0.5 transition-opacity",
            isLast ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100 max-md:opacity-100",
          )}
        >
          <Tip label={copied ? "Copied" : "Copy"}>
            <button
              className={iconBtn}
              aria-label="Copy reply"
              onClick={() => {
                void navigator.clipboard.writeText(m.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </button>
          </Tip>
          {isLast && (
            <Tip label="Regenerate">
              <button className={iconBtn} aria-label="Regenerate reply" onClick={onRegenerate}>
                <RotateCcw />
              </button>
            </Tip>
          )}
          <Tip label="Good reply">
            <button className={cn(iconBtn, feedback === 1 && "text-accent-ink")} aria-label="Good reply" aria-pressed={feedback === 1} onClick={() => void rate(1)}>
              <ThumbsUp />
            </button>
          </Tip>
          <Tip label="Bad reply">
            <button className={cn(iconBtn, feedback === -1 && "text-accent-ink")} aria-label="Bad reply" aria-pressed={feedback === -1} onClick={() => void rate(-1)}>
              <ThumbsDown />
            </button>
          </Tip>
        </div>
      )}
    </div>
  );
}
