"use client";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Check, ChevronDown, Clock3, Gauge, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { DomainIcon } from "@/components/domain-icon";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/dropdown";
import { DOMAINS, LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ComposerHandle = { focus: () => void; setValue: (v: string) => void };
export type QuickFilters = { domain?: string; level?: string; weeks?: number };

/** Separator between what the student typed and the quick filters, also used to render the bubble. */
export const FILTER_SEPARATOR = "\n\n— ";

export function withFilters(text: string, f: QuickFilters): string {
  const parts = [f.domain, f.level ? `${f.level} level` : undefined, f.weeks ? `up to ${f.weeks} weeks` : undefined].filter(Boolean);
  return parts.length ? `${text}${FILTER_SEPARATOR}${parts.join(" · ")}` : text;
}

// ── Voice input (Web Speech API; hidden where the browser has none) ───────────────────────────
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const speechCtor = () =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition ??
      null);

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors data-[state=open]:bg-sunken [&_svg]:size-3.5";
const chipOff = "border-transparent text-muted hover:bg-sunken hover:text-text";
const chipOn = "border-accent/40 bg-accent-soft text-accent-ink";

export const Composer = forwardRef<
  ComposerHandle,
  {
    onSend: (text: string) => void;
    onStop: () => void;
    streaming: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    filters?: QuickFilters;
    onFiltersChange?: (f: QuickFilters) => void;
  }
>(function Composer({ onSend, onStop, streaming, placeholder = "Ask for a project, a plan, or anything you're stuck on…", autoFocus, filters, onFiltersChange }, ref) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");
  const canListen = useSyncExternalStore(
    () => () => {},
    () => Boolean(speechCtor()),
    () => false,
  );

  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus(), setValue }));

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => () => rec.current?.stop(), []);

  const send = () => {
    const t = value.trim();
    if (!t || streaming) return;
    rec.current?.stop();
    onSend(withFilters(t, filters ?? {}));
    setValue("");
  };

  function toggleVoice() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = false;
    base.current = value ? `${value.trimEnd()} ` : "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]![0].transcript;
      setValue(base.current + text);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Microphone access was blocked. Allow it in your browser to talk.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("Couldn't hear that. Try again.");
    };
    r.onend = () => {
      setListening(false);
      ta.current?.focus();
    };
    rec.current = r;
    r.start();
    setListening(true);
  }

  const set = (patch: QuickFilters) => onFiltersChange?.({ ...filters, ...patch });
  const f = filters ?? {};

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn(
        "rounded-[24px] border border-border bg-surface shadow-[var(--shadow-float)] transition-[border-color,box-shadow] duration-200",
        "focus-within:border-accent/45 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_12%,transparent),var(--shadow-float)]",
        listening && "border-accent/60",
      )}
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        ref={ta}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        maxLength={3900}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={listening ? "Listening… speak now" : placeholder}
        className="block max-h-[220px] min-h-[52px] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[16px] leading-6 text-text outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
        {onFiltersChange && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5" role="group" aria-label="Quick filters">
            <Menu>
              <MenuTrigger className={cn(chip, f.domain ? chipOn : chipOff)} aria-label={f.domain ? `Domain: ${f.domain}` : "Choose a domain"}>
                {f.domain ? <DomainIcon domain={f.domain} /> : <ChevronDown />}
                <span className="max-w-[9rem] truncate">{f.domain ?? "Domain"}</span>
              </MenuTrigger>
              <MenuContent align="start" side="top" className="max-h-80 overflow-y-auto">
                <MenuLabel>Steer ideas towards</MenuLabel>
                {DOMAINS.map((d) => (
                  <MenuItem key={d} onSelect={() => set({ domain: d })}>
                    <DomainIcon domain={d} /> {d}
                    {f.domain === d && <Check className="ml-auto !text-accent-ink" />}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger className={cn(chip, f.level ? chipOn : chipOff)} aria-label={f.level ? `Level: ${f.level}` : "Choose a level"}>
                <Gauge /> {f.level ?? "Level"}
              </MenuTrigger>
              <MenuContent align="start" side="top">
                {LEVELS.map((l) => (
                  <MenuItem key={l} onSelect={() => set({ level: l })}>
                    {l}
                    {f.level === l && <Check className="ml-auto !text-accent-ink" />}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger className={cn(chip, f.weeks ? chipOn : chipOff)} aria-label={f.weeks ? `Up to ${f.weeks} weeks` : "Choose weeks"}>
                <Clock3 /> {f.weeks ? `${f.weeks} wks` : "Weeks"}
              </MenuTrigger>
              <MenuContent align="start" side="top">
                {[4, 6, 8, 10, 12, 16, 20, 24].map((w) => (
                  <MenuItem key={w} onSelect={() => set({ weeks: w })}>
                    Up to {w} weeks
                    {f.weeks === w && <Check className="ml-auto !text-accent-ink" />}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            {(f.domain || f.level || f.weeks) && (
              <button type="button" onClick={() => onFiltersChange({})} className={cn(chip, chipOff)} aria-label="Clear quick filters">
                <X /> Clear
              </button>
            )}
          </div>
        )}
        {!onFiltersChange && <div className="flex-1" />}
        {canListen && !streaming && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "Stop voice input" : "Speak your message"}
            aria-pressed={listening}
            className={cn(
              "relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
              listening ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-sunken hover:text-text",
            )}
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" aria-hidden="true" />}
            <Mic className="relative size-[18px]" />
          </button>
        )}
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-text text-page transition-transform hover:scale-105"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send message"
            disabled={!value.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-ink text-accent-fg shadow-[0_6px_16px_-6px_var(--accent)] transition-all duration-150 hover:scale-105 disabled:scale-100 disabled:bg-sunken disabled:text-muted disabled:shadow-none"
          >
            <ArrowUp className="size-[18px]" />
          </button>
        )}
      </div>
    </form>
  );
});
