import type { AppliedFilters } from "@/lib/validators";

/**
 * "Showing **Healthcare** · Mobile App · Beginner", from the filters the ranking actually applied,
 * plus a muted note when it had to relax one ("not enough Beginner ideas, so some are Intermediate").
 */
export function FilterLine({
  applied,
  requested,
  cardLevels = [],
  writerOffline,
}: {
  applied: AppliedFilters | null | undefined;
  requested?: { levels: string[] | null; approaches: string[] | null } | null;
  cardLevels?: string[];
  writerOffline?: boolean;
}) {
  if (!applied && !writerOffline) return null;
  const domains = applied?.domains ?? [];
  const rest = [...(applied?.approaches ?? []), ...(applied?.levels ?? [])];
  const notes: string[] = [];
  for (const r of applied?.relaxed ?? []) {
    if (r === "level" && requested?.levels?.length) {
      const others = [...new Set(cardLevels.filter((l) => l && !requested.levels!.includes(l)))];
      notes.push(`not enough ${requested.levels.join(" or ")} ideas, so some are ${others.length ? others.join(" or ") : "at other levels"}`);
    } else if (r === "approach" && requested?.approaches?.length) {
      notes.push(`not enough ${requested.approaches.join(" or ")} ideas, so some use other approaches`);
    }
  }
  const showing = domains.length > 0 || rest.length > 0;
  return (
    <div className="mb-2.5 space-y-0.5 font-sans text-[13px]" data-testid="filter-line">
      {showing && (
        <p className="text-muted">
          Showing{" "}
          {domains.map((d, i) => (
            <span key={d}>
              {i > 0 && " & "}
              <strong className="font-semibold text-text">{d}</strong>
            </span>
          ))}
          {rest.map((r, i) => (
            <span key={r}>
              {domains.length > 0 || i > 0 ? " · " : ""}
              {r}
            </span>
          ))}
          {notes.length > 0 && <span className="text-muted/90"> ({notes.join("; ")})</span>}
        </p>
      )}
      {writerOffline && <p className="text-muted">Writer offline, showing the closest catalogue projects.</p>}
    </div>
  );
}
