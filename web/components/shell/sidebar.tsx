"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search, SquarePen } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useApp } from "./app-context";
import { ChatList } from "./chat-list";
import { StatusDot } from "./status-dot";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/saved", label: "Saved", icon: Bookmark },
];

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { setCollapsed, setPaletteOpen } = useApp();

  const item = (href: string, label: string, Icon: typeof LayoutGrid, active: boolean) => {
    const link = (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] transition-colors",
          active ? "bg-sunken font-medium text-text" : "text-text/85 hover:bg-sunken/70",
          collapsed && "w-9 justify-center px-0",
        )}
      >
        <Icon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
        {!collapsed && label}
      </Link>
    );
    return collapsed ? (
      <Tip key={href} label={label} side="right">
        {link}
      </Tip>
    ) : (
      <div key={href}>{link}</div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center justify-between px-3", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <Tip label="Expand sidebar" side="right">
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="group relative flex size-9 items-center justify-center rounded-[10px] hover:bg-sunken"
            >
              <LogoMark className="group-hover:opacity-0" />
              <PanelLeftOpen className="absolute size-[18px] text-muted opacity-0 group-hover:opacity-100" />
            </button>
          </Tip>
        ) : (
          <>
            <Link href="/chat" onClick={onNavigate} aria-label="ProjectLens home" className="rounded-md px-1">
              <Logo />
            </Link>
            {!onNavigate && (
              <Tip label="Collapse sidebar" side="right">
                <button
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                  className="flex size-8 items-center justify-center rounded-[8px] text-muted hover:bg-sunken hover:text-text"
                >
                  <PanelLeftClose className="size-[18px]" />
                </button>
              </Tip>
            )}
          </>
        )}
      </div>

      <div className={cn("space-y-0.5 px-2", collapsed && "flex flex-col items-center")}>
        {collapsed ? (
          <Tip label="New chat" side="right">
            <Link
              href="/chat"
              onClick={onNavigate}
              aria-label="New chat"
              className="flex size-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink hover:brightness-95"
            >
              <SquarePen className="size-[18px]" />
            </Link>
          </Tip>
        ) : (
          <Link
            href="/chat"
            onClick={onNavigate}
            className="mb-1 flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-medium text-accent-ink hover:bg-accent-soft"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-accent-ink text-accent-fg">
              <SquarePen className="size-3.5" aria-hidden="true" />
            </span>
            New chat
          </Link>
        )}
        {collapsed ? (
          <Tip label="Search (⌘K)" side="right">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search and commands"
              className="flex size-9 items-center justify-center rounded-[10px] text-muted hover:bg-sunken"
            >
              <Search className="size-[18px]" />
            </button>
          </Tip>
        ) : (
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] text-text/85 hover:bg-sunken/70"
          >
            <Search className="size-[18px] text-muted" aria-hidden="true" />
            Search
            <kbd className="ml-auto rounded border border-border px-1.5 font-sans text-[11px] text-muted" suppressHydrationWarning>
              {isMac() ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
        )}
        {NAV.map((n) => item(n.href, n.label, n.icon, pathname.startsWith(n.href)))}
      </div>

      <div className={cn("mt-4 min-h-0 flex-1 overflow-y-auto", collapsed && "invisible")}>
        {!collapsed && <ChatList onNavigate={onNavigate} />}
      </div>

      <div className={cn("border-t border-border p-2", collapsed && "flex flex-col items-center gap-2")}>
        <UserMenu compact={collapsed} />
        {!collapsed && (
          <div className="flex items-center justify-between px-1.5 pt-1.5">
            <StatusDot />
            <span className="text-[11px] text-muted">v1.0</span>
          </div>
        )}
      </div>
    </div>
  );
}
