"use client";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useTheme } from "next-themes";
import { Bookmark, LayoutGrid, MessageSquare, Moon, SquarePen, UserRound } from "lucide-react";
import { useApp } from "./app-context";

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-[8px] px-3 py-2 text-[14px] text-text data-[selected=true]:bg-sunken [&_svg]:size-4 [&_svg]:text-muted";

/** Ctrl/Cmd+K palette. Loaded on first open (see app-shell.tsx). */
export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, chats } = useApp();
  const { resolvedTheme, setTheme } = useTheme();

  const go = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  return (
    <D.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-float)] data-[state=open]:animate-slide-up"
        >
          <D.Title className="sr-only">Command palette</D.Title>
          <Command label="Command palette" loop>
            <Command.Input
              autoFocus
              placeholder="Search chats or type a command…"
              className="h-12 w-full border-b border-border bg-transparent px-4 text-[15px] outline-none placeholder:text-muted"
            />
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>
              <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
                <Command.Item className={itemClass} onSelect={() => go("/chat")}>
                  <SquarePen /> New chat
                  <span className="ml-auto text-xs text-muted">⇧⌘O</span>
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => go("/dashboard")}>
                  <LayoutGrid /> Go to dashboard
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => go("/saved")}>
                  <Bookmark /> Go to saved
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => go("/profile")}>
                  <UserRound /> Edit profile
                </Command.Item>
                <Command.Item
                  className={itemClass}
                  onSelect={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                    setPaletteOpen(false);
                  }}
                >
                  <Moon /> Toggle theme
                </Command.Item>
              </Command.Group>
              {!!chats?.length && (
                <Command.Group heading="Chats" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
                  {chats.map((c) => (
                    <Command.Item key={c.id} value={`chat ${c.title} ${c.id}`} className={itemClass} onSelect={() => go(`/chat/${c.id}`)}>
                      <MessageSquare /> <span className="truncate">{c.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
