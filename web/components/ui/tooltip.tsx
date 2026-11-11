"use client";
import { Tooltip as T } from "radix-ui";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <T.Provider delayDuration={400} skipDelayDuration={200}>
    {children}
  </T.Provider>
);

export function Tip({ label, children, side = "top" }: { label: string; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[60] rounded-md bg-text px-2 py-1 text-xs text-page data-[state=delayed-open]:animate-fade-in"
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
