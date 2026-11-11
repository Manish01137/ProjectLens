"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, fetchJson } from "@/lib/utils";
import { useApp, type ChatSummary } from "./app-context";

function group(chats: ChatSummary[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 7 * 86_400_000;
  const groups: { label: string; items: ChatSummary[] }[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of chats) {
    const t = new Date(c.updatedAt).getTime();
    const g = c.pinned ? 0 : t >= startOfToday ? 1 : t >= weekAgo ? 2 : 3;
    groups[g]!.items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

export function ChatList({ onNavigate }: { onNavigate?: () => void }) {
  const { chats, upsertChat, removeChat } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ChatSummary | null>(null);

  if (chats === null) {
    return (
      <div className="space-y-2 px-3 py-2" aria-label="Loading chats">
        {[70, 85, 60, 75].map((w) => (
          <Skeleton key={w} className="h-5" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (!chats.length) {
    return <p className="px-4 py-2 text-[13px] text-muted">Your conversations will appear here.</p>;
  }

  async function patch(c: ChatSummary, data: Partial<Pick<ChatSummary, "title" | "pinned">>) {
    try {
      await fetchJson(`/api/chats/${c.id}`, { method: "PATCH", body: JSON.stringify(data) });
      upsertChat({ ...c, ...data });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doDelete(c: ChatSummary) {
    try {
      await fetchJson(`/api/chats/${c.id}`, { method: "DELETE" });
      removeChat(c.id);
      toast.success("Chat deleted");
      if (pathname === `/chat/${c.id}`) router.push("/chat");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <nav aria-label="Chat history" className="space-y-4 px-2 pb-4">
      {group(chats).map((g) => (
        <div key={g.label}>
          <h2 className="px-2.5 pb-1 font-sans text-[12px] font-medium text-muted">{g.label}</h2>
          <ul className="space-y-px">
            {g.items.map((c) => {
              const active = pathname === `/chat/${c.id}`;
              return (
                <li key={c.id} className="group relative">
                  {renaming === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = draft.trim();
                        setRenaming(null);
                        if (t && t !== c.title) void patch(c, { title: t });
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Chat title"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                        onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                        className="h-8 w-full rounded-[8px] border border-accent bg-surface px-2.5 text-[14px] outline-none"
                        maxLength={120}
                      />
                    </form>
                  ) : (
                    <>
                      <Link
                        href={`/chat/${c.id}`}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block truncate rounded-[8px] py-1.5 pl-2.5 pr-8 text-[14px] transition-colors",
                          active ? "bg-sunken text-text" : "text-text/85 hover:bg-sunken/70",
                        )}
                      >
                        {c.title}
                      </Link>
                      <Menu>
                        <MenuTrigger
                          aria-label={`Actions for ${c.title}`}
                          className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted opacity-0 hover:bg-border/60 hover:text-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </MenuTrigger>
                        <MenuContent align="start">
                          <MenuItem
                            onSelect={() => {
                              setDraft(c.title);
                              setRenaming(c.id);
                            }}
                          >
                            <Pencil /> Rename
                          </MenuItem>
                          <MenuItem onSelect={() => void patch(c, { pinned: !c.pinned })}>
                            {c.pinned ? <PinOff /> : <Pin />} {c.pinned ? "Unpin" : "Pin"}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem danger onSelect={() => setConfirmDelete(c)}>
                            <Trash2 /> Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription className="mt-2">
            &ldquo;{confirmDelete?.title}&rdquo; and its messages will be removed. Projects you saved stay saved.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const c = confirmDelete;
                setConfirmDelete(null);
                if (c) void doDelete(c);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
