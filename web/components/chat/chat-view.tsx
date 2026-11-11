"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, BookOpen, Clock3, Download, Sparkles, Target, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import { useApp } from "@/components/shell/app-context";
import { Tip } from "@/components/ui/tooltip";
import { greetingFor } from "@/lib/utils";
import type { Project } from "@/lib/validators";
import { Composer, FILTER_SEPARATOR, type ComposerHandle, type QuickFilters } from "./composer";
import { AssistantMessage, UserMessage, type ChatMessage } from "./message";

export type ProfileSummary = { branch: string | null; skills: string[]; weeks: number; level: string };

type Props = {
  chatId: string | null;
  initialMessages: ChatMessage[];
  firstName: string;
  suggestions: string[];
  profile: ProfileSummary;
};

const SUGGESTION_STYLE: { icon: LucideIcon; kicker: string }[] = [
  { icon: Sparkles, kicker: "New ideas" },
  { icon: Clock3, kicker: "Fits my time" },
  { icon: BookOpen, kicker: "Learn" },
  { icon: Target, kicker: "My goal" },
];

/** Next steps offered under the latest reply, based on what it was. */
export function followUpsFor(m: ChatMessage | undefined): string[] {
  if (!m || m.pending) return [];
  if (m.projects?.length)
    return ["Make it easier", "Show me different ones", "Something more advanced", "How do I build the first one?"];
  switch (m.intent) {
    case "explain_project":
      return ["What dataset should I use?", "What should I learn first?", "Suggest a similar project"];
    case "greeting":
    case "chitchat":
      return ["Suggest a project for me", "What makes a good final-year project?", "How do I choose between two ideas?"];
    case "general_question":
      return ["Explain it more simply", "Suggest a project that uses this"];
    case "profile_update":
      return ["Suggest projects with my updated profile"];
    default:
      return [];
  }
}

function toMarkdown(title: string, messages: ChatMessage[]): string {
  const out = [`# ${title}`, "", `_Exported from ProjectLens on ${new Date().toLocaleDateString("en-IN")}_`, ""];
  for (const m of messages) {
    if (m.role === "user") {
      out.push(`**You:** ${m.content.split(FILTER_SEPARATOR).join(" (")}${m.content.includes(FILTER_SEPARATOR) ? ")" : ""}`, "");
    } else {
      out.push(`**ProjectLens:**`, "", m.content, "");
      (m.projects ?? []).forEach((p, i) => {
        out.push(`### ${i + 1}. ${p.title}`, "", `${p.domain}${p.level ? ` · ${p.level}` : ""}${p.duration_weeks ? ` · ${p.duration_weeks} weeks` : ""}`, "", p.problem_statement, "");
        if (p.tech_stack) out.push(`Tech stack: ${p.tech_stack}`, "");
        if (p.milestones?.length) out.push(...p.milestones.map((ms) => `- Week ${ms.week}: ${ms.task}`), "");
      });
    }
  }
  return out.join("\n");
}

/** Parses "event: x\ndata: {...}\n\n" frames from a streaming response. */
async function* readSse(body: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const event = /^event: (.+)$/m.exec(frame)?.[1];
        const data = /^data: (.+)$/m.exec(frame)?.[1];
        if (event && data) yield { event, data: JSON.parse(data) as Record<string, unknown> };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function Greeting({ firstName }: { firstName: string }) {
  const [part] = useState(() => greetingFor());
  return (
    <h1 className="text-center text-[2.1rem] font-semibold leading-tight tracking-[-0.015em] sm:text-[2.8rem]" suppressHydrationWarning>
      {part}, <span className="text-gradient">{firstName}</span>
    </h1>
  );
}

export function ChatView({ chatId: initialChatId, initialMessages, firstName, suggestions, profile }: Props) {
  const { upsertChat, chats } = useApp();
  const [filters, setFilters] = useState<QuickFilters>({});
  const [atBottom, setAtBottom] = useState(true);
  const [chatId, setChatId] = useState(initialChatId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const composer = useRef<ComposerHandle>(null);

  // Follow the stream unless the reader has scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (text: string, opts: { regenerate?: boolean } = {}) => {
      if (streaming) return;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      stick.current = true;
      const tmpId = `tmp-${Date.now()}`;
      setMessages((prev) => {
        let next = prev;
        if (opts.regenerate && next[next.length - 1]?.role === "assistant") next = next.slice(0, -1);
        if (!opts.regenerate) next = [...next, { id: `${tmpId}-u`, role: "user", content: text }];
        return [...next, { id: tmpId, role: "assistant", content: "", pending: true }];
      });
      setStreaming(true);
      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? fn(m) : m)));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chatId: chatId ?? undefined, message: text, regenerate: opts.regenerate }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Something went wrong");
        }
        let finalId: string | null = null;
        for await (const { event, data } of readSse(res.body, ctrl.signal)) {
          if (event === "meta") {
            const id = data.chatId as string;
            if (!chatId) {
              setChatId(id);
              window.history.replaceState(null, "", `/chat/${id}`);
            }
            upsertChat({ id, title: data.title as string, pinned: false, updatedAt: new Date().toISOString() });
          } else if (event === "token") {
            patch((m) => ({ ...m, content: m.content + (data.text as string) }));
          } else if (event === "status") {
            patch((m) => ({ ...m, status: data.text as string }));
          } else if (event === "cards") {
            patch((m) => ({ ...m, projects: data.projects as Project[], meta: data.meta as ChatMessage["meta"] }));
          } else if (event === "intent") {
            patch((m) => ({ ...m, intent: data.intent as string }));
          } else if (event === "profile") {
            toast.success("Profile updated", { description: data.summary as string });
          } else if (event === "error") {
            toast.error(data.message as string);
          } else if (event === "done") {
            finalId = data.messageId as string;
          }
        }
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, id: finalId ?? m.id, pending: false } : m)));
      } catch (err) {
        if (ctrl.signal.aborted) {
          patch((m) => ({ ...m, pending: false, content: m.content || "_(stopped)_" }));
        } else {
          toast.error((err as Error).message);
          setMessages((prev) => prev.filter((m) => m.id !== tmpId));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        composer.current?.focus();
      }
    },
    [chatId, streaming, upsertChat],
  );

  const stop = () => abortRef.current?.abort();
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const empty = messages.length === 0;
  const last = messages[messages.length - 1];
  const followUps = !streaming && last?.role === "assistant" ? followUpsFor(last) : [];
  const title = chats?.find((c) => c.id === chatId)?.title ?? "New chat";

  function exportChat() {
    const blob = new Blob([toMarkdown(title, messages)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "projectlens-chat"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Chat exported as Markdown");
  }

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const skillsLine = profile.skills.slice(0, 2).join(", ") + (profile.skills.length > 2 ? ` +${profile.skills.length - 2}` : "");

  return (
    <div className="relative flex h-full flex-col">
      {!empty && (
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-page/80 px-4 backdrop-blur sm:px-6">
          <h1 className="min-w-0 truncate font-sans text-[14px] font-medium" title={title}>
            {title}
          </h1>
          <Tip label="Export as Markdown">
            <button
              onClick={exportChat}
              aria-label="Export chat as Markdown"
              className="flex size-8 items-center justify-center rounded-[8px] text-muted hover:bg-sunken hover:text-text"
            >
              <Download className="size-4" />
            </button>
          </Tip>
        </header>
      )}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          stick.current = near;
          if (near !== atBottom) setAtBottom(near);
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {empty ? (
          <div className="relative isolate mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-center px-4 pb-10 pt-12 sm:px-6">
            <div className="aurora -z-10 opacity-25" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface shadow-[var(--shadow-float)]" aria-hidden="true">
              <LogoMark className="size-8" />
            </div>
            <Greeting firstName={firstName} />
            <p className="mt-3 text-center text-[16px] text-muted">What are we building this semester?</p>
            <Link
              href="/profile"
              className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-[12.5px] text-muted backdrop-blur transition-colors hover:border-border-strong hover:text-text"
            >
              <span className="truncate">
                {[profile.branch, skillsLine, profile.level, `${profile.weeks} weeks`].filter(Boolean).join(" · ")}
              </span>
              <span className="font-medium text-accent-ink">Edit</span>
            </Link>
            <div className="mt-7">
              <Composer
                ref={composer}
                onSend={(t) => void run(t)}
                onStop={stop}
                streaming={streaming}
                autoFocus
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2" aria-label="Suggestions">
              {suggestions.map((s, i) => {
                const style = SUGGESTION_STYLE[i % SUGGESTION_STYLE.length]!;
                return (
                  <button
                    key={s}
                    onClick={() => void run(s)}
                    className="glow-card group flex items-start gap-3 rounded-[14px] border border-border bg-surface/90 p-3.5 text-left backdrop-blur"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">
                      <style.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] font-medium uppercase tracking-wide text-muted">{style.kicker}</span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-text">{s}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[760px] space-y-8 px-4 pb-8 pt-8 sm:px-6" aria-live="polite" aria-busy={streaming}>
            {messages.map((m, i) =>
              m.role === "user" ? (
                <UserMessage key={m.id} m={m} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  m={m}
                  isLast={i === messages.length - 1}
                  streaming={streaming}
                  onRegenerate={() => lastUser && void run(lastUser.content, { regenerate: true })}
                  onExplain={(idx, p) => void run(`Explain project #${idx + 1}: ${p.title}`)}
                />
              ),
            )}
            {followUps.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:pl-11" aria-label="Suggested follow-ups">
                {followUps.map((f) => (
                  <button
                    key={f}
                    onClick={() => void run(f)}
                    className="animate-fade-in rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13.5px] text-text/85 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-ink"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {!empty && !atBottom && (
        <button
          onClick={scrollToBottom}
          aria-label="Jump to latest message"
          className="absolute bottom-36 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-[var(--shadow-float)] animate-fade-in hover:text-text"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
      {!empty && (
        <div className="shrink-0 bg-gradient-to-t from-page via-page to-transparent px-4 pb-4 pt-2 sm:px-6">
          <div className="mx-auto w-full max-w-[760px]">
            <Composer
              ref={composer}
              onSend={(t) => void run(t)}
              onStop={stop}
              streaming={streaming}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <p className="mt-2 text-center text-[12px] text-muted">
              Enter to send · Shift+Enter for a new line · Ideas come from the ProjectLens models, so check plans with your guide.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
