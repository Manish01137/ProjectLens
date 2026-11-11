"use client";
import { useEffect, useState } from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

type Part = { ok: boolean; detail: string };
type Health = { status: "ok" | "degraded" | "down"; database: Part; retriever: Part; intent: Part; llm: Part & { provider?: string } };

const ROWS: [keyof Omit<Health, "status">, string][] = [
  ["database", "Database"],
  ["retriever", "Retriever"],
  ["intent", "Intent model"],
  ["llm", "LLM"],
];

/** Sidebar footer: one dot for the whole system, details for each part on hover or focus. */
export function StatusDot() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && j && setH(j as Health))
        .catch(() => {});
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const word = !h ? "Checking" : h.status === "ok" ? "Online" : h.status === "degraded" ? "Limited" : "Warming up";
  const summary = !h ? "Checking services" : ROWS.map(([k, label]) => `${label}: ${h[k].ok ? "ok" : h[k].detail}`).join(". ");
  const dot = (ok: boolean | null) => cn("size-2 shrink-0 rounded-full", ok === null ? "bg-border-strong" : ok ? "bg-success" : "bg-[#d4a03c]");

  return (
    <T.Root>
      <T.Trigger asChild>
        <span role="status" aria-label={summary} tabIndex={0} className="inline-flex items-center gap-1.5 rounded px-1 text-[12px] text-muted">
          <span className={cn(dot(h ? h.status === "ok" : null), h?.status === "down" && "bg-danger")} />
          {word}
        </span>
      </T.Trigger>
      <T.Portal>
        <T.Content side="top" sideOffset={6} className="z-[60] w-64 rounded-[10px] border border-border bg-surface p-2.5 text-[12.5px] shadow-[var(--shadow-float)]">
          {!h ? (
            <p className="text-muted">Checking services…</p>
          ) : (
            <ul className="space-y-1.5">
              {ROWS.map(([k, label]) => (
                <li key={k} className="flex items-start gap-2">
                  <span className={cn(dot(h[k].ok), "mt-1.5")} aria-hidden="true" />
                  <span>
                    <span className="font-medium text-text">{label}</span>
                    <span className="block text-muted">{h[k].detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
