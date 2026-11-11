"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { Menu, SquarePen } from "lucide-react";
import { SheetContent } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";
import { AppProvider, useApp, type SessionUser } from "./app-context";
import { SidebarContent } from "./sidebar";

// Heavy, rarely-needed pieces load on first use to keep every page fast.
const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });
const ProjectDetailPanel = dynamic(() => import("@/components/projects/detail-panel").then((m) => m.ProjectDetailPanel), {
  ssr: false,
});

/** Global shortcuts: Ctrl/Cmd+K palette, Ctrl/Cmd+Shift+O new chat, Esc closes panels. */
function useShortcuts() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, detail, closeDetail } = useApp();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        router.push("/chat");
      } else if (e.key === "Escape" && detail && !paletteOpen) {
        closeDetail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen, router, detail, closeDetail]);
}

function Shell({ children }: { children: React.ReactNode }) {
  const { collapsed, mobileNavOpen, setMobileNavOpen, paletteOpen, detail } = useApp();
  useShortcuts();
  // Mount the lazy pieces once they are first needed, then keep them for their close animations.
  const [paletteUsed, setPaletteUsed] = useState(false);
  const [detailUsed, setDetailUsed] = useState(false);
  if (paletteOpen && !paletteUsed) setPaletteUsed(true);
  if (detail && !detailUsed) setDetailUsed(true);
  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden shrink-0 border-r border-border bg-page transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-[60px]" : "w-[272px]",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      <D.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" label="Navigation" aria-describedby={undefined}>
          <D.Title className="sr-only">Navigation</D.Title>
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2 md:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-sunken"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/chat" aria-label="ProjectLens home">
            <LogoMark className="size-6" />
          </Link>
          <Link href="/chat" aria-label="New chat" className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-sunken">
            <SquarePen className="size-5" />
          </Link>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      {paletteUsed && <CommandPalette />}
      {detailUsed && <ProjectDetailPanel />}
    </div>
  );
}

export function AppShell({
  user,
  initialCollapsed,
  children,
}: {
  user: SessionUser;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <AppProvider user={user} initialCollapsed={initialCollapsed}>
      <TooltipProvider>
        <Shell>{children}</Shell>
      </TooltipProvider>
    </AppProvider>
  );
}
