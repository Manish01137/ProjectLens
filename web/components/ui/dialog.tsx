"use client";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export const DialogTitle = ({ className, ...p }: React.ComponentProps<typeof D.Title>) => (
  <D.Title className={cn("font-serif text-xl font-semibold", className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: React.ComponentProps<typeof D.Description>) => (
  <D.Description className={cn("text-sm text-muted", className)} {...p} />
);

export function DialogContent({
  className,
  children,
  hideClose,
  ...props
}: React.ComponentProps<typeof D.Content> & { hideClose?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 rounded-[14px] border border-border bg-surface p-6 shadow-[var(--shadow-float)] focus:outline-none data-[state=open]:animate-slide-up",
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <D.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted hover:bg-sunken hover:text-text" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}

/** Right or left slide-over panel (detail panel, mobile sidebar). */
export function SheetContent({
  side = "right",
  className,
  children,
  label,
  ...props
}: React.ComponentProps<typeof D.Content> & { side?: "left" | "right"; label: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/25 data-[state=open]:animate-fade-in" />
      <D.Content
        aria-label={label}
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-surface shadow-[var(--shadow-float)] focus:outline-none",
          side === "right"
            ? "right-0 w-full max-w-[560px] border-l border-border data-[state=open]:animate-[sheet-in-right_200ms_ease-out]"
            : "left-0 w-[290px] max-w-[85vw] border-r border-border data-[state=open]:animate-[sheet-in-left_200ms_ease-out]",
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}
