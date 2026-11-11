"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { useApp } from "./app-context";

export function Avatar({ name, className }: { name: string | null; className?: string }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink", className)}
    >
      {initials}
    </span>
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useApp();
  const { theme, setTheme } = useTheme();
  return (
    <Menu>
      <MenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-sunken data-[state=open]:bg-sunken",
          compact && "w-auto",
        )}
      >
        <Avatar name={user.name} />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{user.name ?? "Student"}</span>
            <span className="block truncate text-[12px] text-muted">{user.email}</span>
          </span>
        )}
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-60">
        <MenuLabel>{user.email}</MenuLabel>
        <MenuItem asChild>
          <Link href="/profile">
            <UserRound /> Profile
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1" role="radiogroup" aria-label="Theme">
          {(
            [
              ["light", Sun, "Light"],
              ["dark", Moon, "Dark"],
              ["system", Monitor, "System"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[8px] py-1.5 text-[12px] text-muted hover:bg-sunken",
                theme === value && "bg-sunken text-text",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => void signOut({ redirectTo: "/" })}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
