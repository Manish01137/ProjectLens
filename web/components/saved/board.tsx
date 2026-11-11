"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowRightLeft, GripVertical, MoreHorizontal, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { useApp } from "@/components/shell/app-context";
import { SAVED_STATUSES, type SavedStatus } from "@/lib/constants";
import { cn, fetchJson } from "@/lib/utils";
import type { Project } from "@/lib/validators";

export type SavedItem = { id: string; projectId: string; status: SavedStatus; note: string; project: Project };

const COLUMN_HINT: Record<SavedStatus, string> = {
  Shortlisted: "Ideas worth a closer look",
  "Discussing with guide": "Talking these through",
  Chosen: "Your final pick",
};

function NoteField({ item, onSaved }: { item: SavedItem; onSaved: (note: string) => void }) {
  const [open, setOpen] = useState(Boolean(item.note));
  const [value, setValue] = useState(item.note);
  const last = useRef(item.note);
  const save = async () => {
    if (value === last.current) return;
    try {
      await fetchJson(`/api/saved/${item.id}`, { method: "PATCH", body: JSON.stringify({ note: value }) });
      last.current = value;
      onSaved(value);
      toast.success("Note saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="relative z-10 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <NotebookPen className="size-3.5" /> Add a note
      </button>
    );
  }
  return (
    <textarea
      aria-label={`Note for ${item.project.title}`}
      value={value}
      autoFocus={!item.note}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      maxLength={2000}
      rows={2}
      placeholder="What did your guide say? What would you change?"
      className="relative z-10 w-full resize-y rounded-[8px] border border-border bg-page px-2.5 py-1.5 text-[13.5px] leading-relaxed outline-none focus:border-accent"
    />
  );
}

function SavedCard({
  item,
  onMove,
  onRemove,
  onNote,
}: {
  item: SavedItem;
  onMove: (s: SavedStatus) => void;
  onRemove: () => void;
  onNote: (n: string) => void;
}) {
  const { openDetail } = useApp();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const p = item.project;
  return (
    <article
      ref={setNodeRef}
      data-testid="saved-card"
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "relative rounded-[12px] border border-border bg-surface p-3.5 transition-shadow",
        isDragging && "z-20 shadow-[var(--shadow-float)] ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          aria-label={`Drag ${p.title}. Press space to pick up, arrow keys to move.`}
          className="mt-0.5 flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted hover:bg-sunken active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1">
            <Badge>{p.domain}</Badge>
            {p.duration_weeks ? <Badge>{p.duration_weeks} weeks</Badge> : null}
          </div>
          <h3 className="mt-2 text-[1rem] font-semibold leading-snug">
            <button onClick={() => openDetail(p, "saved")} className="text-left hover:underline hover:underline-offset-4">
              {p.title}
            </button>
          </h3>
          <div className="mt-2">
            <NoteField item={item} onSaved={onNote} />
          </div>
        </div>
        <Menu>
          <MenuTrigger
            aria-label={`Actions for ${p.title}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-text"
          >
            <MoreHorizontal className="size-4" />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Move to</MenuLabel>
            {SAVED_STATUSES.filter((s) => s !== item.status).map((s) => (
              <MenuItem key={s} onSelect={() => onMove(s)}>
                <ArrowRightLeft /> {s}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem danger onSelect={onRemove}>
              <Trash2 /> Remove
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </article>
  );
}

function Column({ status, items, children }: { status: SavedStatus; items: SavedItem[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${status}`}
      data-testid={`column-${status}`}
      className={cn(
        "flex min-h-64 flex-col rounded-[14px] border border-border bg-sunken/50 p-3 transition-colors",
        isOver && "border-accent bg-accent-soft/40",
      )}
    >
      <header className="flex items-baseline justify-between px-1 pb-3">
        <div>
          <h2 id={`col-${status}`} className="font-sans text-[14px] font-semibold">
            {status}
          </h2>
          <p className="text-[12px] text-muted">{COLUMN_HINT[status]}</p>
        </div>
        <span className="text-[12px] tabular-nums text-muted" aria-label={`${items.length} projects`}>
          {items.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2.5">
        {children}
        {items.length === 0 && (
          <p className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-border-strong p-4 text-center text-[13px] text-muted">
            Drag a project here
          </p>
        )}
      </div>
    </section>
  );
}

export function SavedBoard({ initial }: { initial: SavedItem[] }) {
  const { markSaved } = useApp();
  const [items, setItems] = useState(initial);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  async function move(id: string, status: SavedStatus) {
    const prev = items;
    const item = items.find((i) => i.id === id);
    if (!item || item.status === status) return;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      await fetchJson(`/api/saved/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(`Moved to ${status}`, { description: item.project.title });
    } catch (e) {
      setItems(prev);
      toast.error((e as Error).message);
    }
  }

  async function remove(item: SavedItem) {
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    try {
      await fetchJson(`/api/saved/${item.id}`, { method: "DELETE" });
      markSaved(item.projectId, false);
      toast("Removed from Saved", { description: item.project.title });
    } catch (e) {
      setItems((xs) => [...xs, item]);
      toast.error((e as Error).message);
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over) void move(String(e.active.id), e.over.id as SavedStatus);
  };

  if (!items.length) {
    return (
      <div className="mt-10 flex flex-col items-center rounded-[12px] border border-dashed border-border-strong px-6 py-16 text-center">
        <h2 className="text-[1.2rem] font-semibold">Nothing saved yet</h2>
        <p className="mt-1.5 max-w-sm text-[14px] text-muted">Save projects from your matches or from a chat, and they&apos;ll wait for you here.</p>
        <div className="mt-5 flex gap-2">
          <Button asChild>
            <Link href="/dashboard">See your matches</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/chat">Ask the assistant</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${items.find((i) => i.id === active.id)?.project.title ?? "project"}.`,
          onDragOver: ({ over }) => (over ? `Over ${over.id}.` : "Not over a column."),
          onDragEnd: ({ over }) => (over ? `Dropped in ${over.id}.` : "Dropped."),
          onDragCancel: () => "Cancelled.",
        },
      }}
    >
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {SAVED_STATUSES.map((status) => {
          const col = items.filter((i) => i.status === status);
          return (
            <Column key={status} status={status} items={col}>
              {col.map((item) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onMove={(s) => void move(item.id, s)}
                  onRemove={() => void remove(item)}
                  onNote={(note) => setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, note } : x)))}
                />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
