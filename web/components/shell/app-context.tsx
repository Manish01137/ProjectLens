"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/validators";

export type ChatSummary = { id: string; title: string; pinned: boolean; updatedAt: string };
export type SessionUser = { name: string | null; email: string; image: string | null };

type Ctx = {
  user: SessionUser;
  chats: ChatSummary[] | null;
  refreshChats: () => Promise<void>;
  upsertChat: (c: ChatSummary) => void;
  removeChat: (id: string) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  detail: { project: Project; context?: "chat" | "dashboard" | "saved" } | null;
  openDetail: (project: Project, context?: "chat" | "dashboard" | "saved") => void;
  closeDetail: () => void;
  savedIds: Set<string>;
  markSaved: (projectId: string, saved: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

export function AppProvider({
  user,
  initialCollapsed,
  children,
}: {
  user: SessionUser;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [detail, setDetail] = useState<Ctx["detail"]>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const refreshChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) setChats(((await res.json()) as { chats: ChatSummary[] }).chats);
    } catch {
      /* keep the old list */
    }
  }, []);

  useEffect(() => {
    fetch("/api/chats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { chats: ChatSummary[] } | null) => j && setChats(j.chats))
      .catch(() => setChats([]));
    fetch("/api/saved")
      .then((r) => (r.ok ? r.json() : { saved: [] }))
      .then((j: { saved: { projectId: string }[] }) => setSavedIds(new Set(j.saved.map((s) => s.projectId))))
      .catch(() => {});
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    document.cookie = `pl_sidebar=${v ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      chats,
      refreshChats,
      upsertChat: (c) =>
        setChats((prev) => {
          const rest = (prev ?? []).filter((x) => x.id !== c.id);
          return [c, ...rest];
        }),
      removeChat: (id) => setChats((prev) => (prev ?? []).filter((x) => x.id !== id)),
      collapsed,
      setCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
      paletteOpen,
      setPaletteOpen,
      detail,
      openDetail: (project, context) => setDetail({ project, context }),
      closeDetail: () => setDetail(null),
      savedIds,
      markSaved: (projectId, saved) =>
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(projectId);
          else next.delete(projectId);
          return next;
        }),
    }),
    [user, chats, refreshChats, collapsed, setCollapsed, mobileNavOpen, paletteOpen, detail, savedIds],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
