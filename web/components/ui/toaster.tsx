"use client";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!bg-surface !text-text !border !border-border !shadow-[var(--shadow-float)] !rounded-[12px] !font-sans",
          description: "!text-muted",
          actionButton: "!bg-accent-ink !text-accent-fg",
        },
      }}
    />
  );
}
