"use client";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
export const MenuLabel = ({ className, ...p }: React.ComponentProps<typeof M.Label>) => (
  <M.Label className={cn("px-2.5 py-1.5 text-xs text-muted", className)} {...p} />
);

export function MenuContent({ className, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 rounded-[12px] border border-border bg-surface p-1 text-sm shadow-[var(--shadow-float)] data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({ className, danger, ...props }: React.ComponentProps<typeof M.Item> & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-[8px] px-2.5 py-2 outline-none data-[highlighted]:bg-sunken [&_svg]:size-4 [&_svg]:text-muted",
        danger && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}
